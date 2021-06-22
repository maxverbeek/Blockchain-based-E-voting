// Copyright 2020-2021 IOTA Stiftung
// SPDX-License-Identifier: Apache-2.0

#![allow(clippy::module_inception)]

mod builder;
mod service;

pub use self::builder::ServiceBuilder;
pub use self::service::Service;
