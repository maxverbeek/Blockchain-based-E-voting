// Copyright 2020-2021 IOTA Stiftung
// SPDX-License-Identifier: Apache-2.0

use core::ops::Deref;
use core::ops::DerefMut;
use hashbrown::HashMap;
use hashbrown::HashSet;
use iota_stronghold::Stronghold;
use iota_stronghold::StrongholdFlags;
use once_cell::sync::OnceCell;
use riker::actors::ActorSystem;
use riker::actors::SystemBuilder;
use std::path::Path;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::Mutex;
use std::sync::MutexGuard;
use std::sync::Once;
use std::thread;
use std::time::Duration;
use std::time::Instant;
use tokio::runtime::Runtime as AsyncRuntime;
use tokio::sync::Mutex as AsyncMutex;
use tokio::sync::MutexGuard as AsyncMutexGuard;
use zeroize::Zeroize;

use crate::error::Error;
use crate::error::PleaseDontMakeYourOwnResult;
use crate::error::Result;
use crate::stronghold::SnapshotStatus;
use crate::utils::fs;
use crate::utils::EncryptionKey;

pub type Password = EncryptionKey;

pub struct Context {
  database: Arc<AsyncMutex<Database>>,
  runtime: Runtime,
}

fn async_runtime() -> Result<&'static Mutex<AsyncRuntime>> {
  static __THIS: OnceCell<Mutex<AsyncRuntime>> = OnceCell::new();

  __THIS.get_or_try_init(|| AsyncRuntime::new().map_err(Into::into).map(Mutex::new))
}

fn async_runtime_guard() -> Result<MutexGuard<'static, AsyncRuntime>> {
  async_runtime().and_then(|mutex| mutex.lock().map_err(|_| Error::StrongholdMutexPoisoned("runtime")))
}

async fn clear_expired_passwords() -> Result<()> {
  let this: &'static Context = Context::get()?;
  let interval: Duration = *this.runtime.password_clear()?;

  thread::sleep(interval);

  if interval.as_nanos() == 0 {
    return Ok(());
  }

  let cleared: Vec<PathBuf> = this
    .runtime
    .password_store()?
    .drain_filter(|_, (_, instant)| instant.elapsed() > interval)
    .map(|(path, _)| path)
    .collect();

  let mut database: _ = this.database.lock().await;

  for path in cleared {
    if database.current_snapshot_eq(&path) {
      database.unload(&this.runtime, &path, true).await?;
    }

    this.runtime.emit(&path, SnapshotStatus::locked())?;
  }

  Ok(())
}

impl Context {
  pub(crate) fn get() -> Result<&'static Self> {
    static __THIS: OnceCell<Context> = OnceCell::new();
    static __POOL: OnceCell<AsyncRuntime> = OnceCell::new();
    static __SWEEP: Once = Once::new();

    let this: &'static Self = __THIS.get_or_try_init::<_, Error>(|| {
      let system: ActorSystem = SystemBuilder::new()
        // // Disable the default actor system logger
        // .log(slog::Logger::root(slog::Discard, slog::o!()))
        .create()?;

      let stronghold: Stronghold = Stronghold::init_stronghold_system(system, Vec::new(), Vec::new());
      let database: Arc<AsyncMutex<Database>> = Arc::new(AsyncMutex::new(Database::new(stronghold)));

      Ok(Self {
        database,
        runtime: Runtime::new(),
      })
    })?;

    // Spawn a background-process to clear expired passwords
    __SWEEP.call_once(|| {
      thread::spawn(|| {
        // unwrap so an error kills the thread
        async_runtime_guard().unwrap().spawn(async {
          loop {
            // unwrap so an error kills the thread
            clear_expired_passwords().await.unwrap();
          }
        });
      });
    });

    Ok(this)
  }

  pub(crate) async fn scope(
    path: &Path,
    name: &[u8],
    flags: &[StrongholdFlags],
  ) -> Result<AsyncMutexGuard<'static, Database>> {
    let this: &Self = Self::get()?;
    let mut database: _ = this.database.lock().await;

    database.switch_snapshot(&this.runtime, path).await?;
    database.activate(&this.runtime, path, name, flags).await?;

    Ok(database)
  }

  pub(crate) fn on_change<T>(listener: T) -> Result<()>
  where
    T: FnMut(&Path, &SnapshotStatus) + Send + 'static,
  {
    Self::get().and_then(|this| this.runtime.on_change(listener))
  }

  pub(crate) fn set_password(path: &Path, password: Password) -> Result<()> {
    Self::get().and_then(|this| this.runtime.set_password(path, password))
  }

  pub(crate) fn set_password_clear(interval: Duration) -> Result<()> {
    Self::get().and_then(|this| this.runtime.set_password_clear(interval))
  }

  pub(crate) fn snapshot_status(path: &Path) -> Result<SnapshotStatus> {
    Self::get().and_then(|this| this.runtime.snapshot_status(path))
  }

  pub(crate) async fn load(path: &Path, password: Password) -> Result<()> {
    let this: &Self = Self::get()?;
    let mut database: _ = this.database.lock().await;

    this.runtime.set_password(path, password)?;
    database.switch_snapshot(&this.runtime, path).await?;
    this.runtime.emit(path, this.runtime.snapshot_status(path)?)?;

    Ok(())
  }

  pub(crate) async fn unload(path: &Path, persist: bool) -> Result<()> {
    let this: &Self = Self::get()?;
    let mut database: _ = this.database.lock().await;

    database.flush(&this.runtime, path, persist).await?;

    Ok(())
  }

  pub(crate) async fn save(path: &Path) -> Result<()> {
    let this: &Self = Self::get()?;
    let mut database: _ = this.database.lock().await;

    database.write(&this.runtime, path).await?;

    Ok(())
  }
}

// =============================================================================
// =============================================================================

pub(crate) struct Database {
  // Stronghold client adapter
  stronghold: Stronghold,
  // Set of clients with initialized actors
  clients_active: HashSet<Vec<u8>>,
  // Set of clients with loaded snapshots
  clients_loaded: HashSet<Vec<u8>>,
  // Currently active Stronghold actor
  current_snapshot: Option<PathBuf>,
}

impl Database {
  const ACTOR_TIMEOUT: Duration = Duration::from_millis(300);

  fn new(stronghold: Stronghold) -> Self {
    Self {
      stronghold,
      clients_active: HashSet::new(),
      clients_loaded: HashSet::new(),
      current_snapshot: None,
    }
  }

  async fn activate(
    &mut self,
    runtime: &Runtime,
    snapshot: &Path,
    client: &[u8],
    flags: &[StrongholdFlags],
  ) -> Result<()> {
    runtime.set_password_access(snapshot)?;

    // Spawn a new actor or switch targets if this client was already spawned
    if self.clients_active.contains(client) {
      self.stronghold.switch_actor_target(client.into()).await.to_result()?;
    } else {
      self
        .stronghold
        .spawn_stronghold_actor(client.into(), flags.to_vec())
        .await
        .to_result()?;

      self.clients_active.insert(client.into());
    }

    if !self.clients_loaded.contains(client) {
      if snapshot.exists() {
        let mut password: Vec<u8> = runtime.password(snapshot)?.to_vec();
        let location: Option<PathBuf> = Some(snapshot.to_path_buf());

        let result: Result<()> = self
          .stronghold
          .read_snapshot(client.into(), None, &password, None, location)
          .await
          .to_result();

        password.zeroize();

        result?
      }

      self.clients_loaded.insert(client.into());
    }

    Ok(())
  }

  async fn unload(&mut self, runtime: &Runtime, snapshot: &Path, persist: bool) -> Result<()> {
    let active: bool = !self.clients_active.is_empty();

    // Write the Stronghold state into a snapshot if requested
    if persist && active {
      self.write(runtime, snapshot).await?;
    }

    // Shutdown all loaded actors
    for client in self.clients_active.iter() {
      // Clear the actor cache
      self
        .stronghold
        .kill_stronghold(client.clone(), false)
        .await
        .to_result()?;

      // Kill the internal actor and client actor
      self
        .stronghold
        .kill_stronghold(client.clone(), true)
        .await
        .to_result()?;
    }

    if active {
      // delay to wait for the actors to be killed
      thread::sleep(Self::ACTOR_TIMEOUT);
    }

    // Clear local caches
    self.clients_active.clear();
    self.clients_loaded.clear();

    Ok(())
  }

  fn current_snapshot_eq(&self, other: &Path) -> bool {
    matches!(
      self.current_snapshot.as_deref(),
      Some(current) if current == other
    )
  }

  fn current_snapshot_neq(&self, other: &Path) -> bool {
    matches!(
      self.current_snapshot.as_deref(),
      Some(current) if current != other
    )
  }

  async fn flush(&mut self, runtime: &Runtime, snapshot: &Path, persist: bool) -> Result<()> {
    if self.current_snapshot_eq(snapshot) {
      self.unload(runtime, snapshot, persist).await?;
    }

    self.current_snapshot = None;

    Ok(())
  }

  async fn write(&mut self, runtime: &Runtime, snapshot: &Path) -> Result<()> {
    fs::ensure_directory(snapshot)?;

    let mut password: Vec<u8> = runtime.password(snapshot)?.to_vec();
    let location: Option<PathBuf> = Some(snapshot.to_path_buf());

    let result: Result<()> = self
      .stronghold
      .write_all_to_snapshot(&password, None, location)
      .await
      .to_result();

    password.zeroize();

    result
  }

  async fn switch_snapshot(&mut self, runtime: &Runtime, snapshot: &Path) -> Result<()> {
    let previous: Option<PathBuf> = if self.current_snapshot_neq(snapshot) {
      self.current_snapshot.replace(snapshot.to_path_buf())
    } else {
      self.current_snapshot = Some(snapshot.to_path_buf());
      None
    };

    if let Some(previous) = previous {
      self.unload(runtime, &previous, true).await?;
    }

    Ok(())
  }
}

impl Deref for Database {
  type Target = Stronghold;

  fn deref(&self) -> &Self::Target {
    &self.stronghold
  }
}

impl DerefMut for Database {
  fn deref_mut(&mut self) -> &mut Self::Target {
    &mut self.stronghold
  }
}

// =============================================================================
// =============================================================================

type PasswordMap = HashMap<PathBuf, (Password, Instant)>;

struct Listener(Box<dyn FnMut(&Path, &SnapshotStatus) + Send>);

struct Runtime {
  event_listeners: Mutex<Vec<Listener>>,
  password_clear: Mutex<Duration>,
  password_store: Mutex<PasswordMap>,
}

impl Runtime {
  const PASSWORD_CLEAR: Duration = Duration::from_millis(0);

  fn new() -> Self {
    Self {
      event_listeners: Mutex::new(Vec::new()),
      password_clear: Mutex::new(Self::PASSWORD_CLEAR),
      password_store: Mutex::new(PasswordMap::new()),
    }
  }

  fn on_change<T>(&self, listener: T) -> Result<()>
  where
    T: FnMut(&Path, &SnapshotStatus) + Send + 'static,
  {
    self.event_listeners()?.push(Listener(Box::new(listener)));

    Ok(())
  }

  fn emit(&self, path: &Path, status: SnapshotStatus) -> Result<()> {
    for listener in self.event_listeners()?.iter_mut() {
      (listener.0)(path, &status);
    }

    Ok(())
  }

  fn snapshot_status(&self, path: &Path) -> Result<SnapshotStatus> {
    if let Some(elapsed) = self.password_elapsed(path)? {
      let interval: Duration = *self.password_clear()?;
      let locked: bool = interval.as_millis() > 0 && elapsed >= interval;

      if locked {
        Ok(SnapshotStatus::locked())
      } else if interval.as_millis() == 0 {
        Ok(SnapshotStatus::unlocked(interval))
      } else {
        Ok(SnapshotStatus::unlocked(interval - elapsed))
      }
    } else {
      Ok(SnapshotStatus::locked())
    }
  }

  fn password(&self, path: &Path) -> Result<Password> {
    self
      .password_store()?
      .get(path)
      .map(|(password, _)| *password)
      .ok_or(Error::StrongholdPasswordNotSet)
  }

  fn password_elapsed(&self, path: &Path) -> Result<Option<Duration>> {
    self
      .password_store()
      .map(|store| store.get(path).map(|(_, interval)| interval.elapsed()))
  }

  fn set_password(&self, path: &Path, password: Password) -> Result<()> {
    self
      .password_store()?
      .insert(path.to_path_buf(), (password, Instant::now()));

    Ok(())
  }

  fn set_password_access(&self, path: &Path) -> Result<()> {
    if let Some((_, ref mut time)) = self.password_store()?.get_mut(path) {
      *time = Instant::now();
    } else {
      return Err(Error::StrongholdPasswordNotSet);
    }

    Ok(())
  }

  fn set_password_clear(&self, interval: Duration) -> Result<()> {
    *self.password_clear()? = interval;

    Ok(())
  }

  fn event_listeners(&self) -> Result<MutexGuard<'_, Vec<Listener>>> {
    self
      .event_listeners
      .lock()
      .map_err(|_| Error::StrongholdMutexPoisoned("listeners"))
  }

  fn password_store(&self) -> Result<MutexGuard<'_, PasswordMap>> {
    self
      .password_store
      .lock()
      .map_err(|_| Error::StrongholdMutexPoisoned("passwords"))
  }

  fn password_clear(&self) -> Result<MutexGuard<'_, Duration>> {
    self
      .password_clear
      .lock()
      .map_err(|_| Error::StrongholdMutexPoisoned("passwords"))
  }
}
