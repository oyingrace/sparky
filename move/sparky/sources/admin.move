module sparky::admin;

use sparky::caps::{Self, AdminCap, OracleCap};
use sparky::community_pool::{Self, CommunityPool};
use sui::object::{Self, UID};
use sui::transfer;
use sui::tx_context::TxContext;

/// Protocol-wide configuration shared object.
public struct Config has key {
    id: UID,
    protocol_fee_bps: u64,
    min_stake: u64,
    max_stake: u64,
    lock_before_deadline_ms: u64,
    current_epoch_id: u64,
}

const DEFAULT_PROTOCOL_FEE_BPS: u64 = 250;
const DEFAULT_MIN_STAKE: u64 = 100_000_000; // 0.1 SUI
const DEFAULT_MAX_STAKE: u64 = 1_000_000_000_000; // 1000 SUI
const DEFAULT_LOCK_BEFORE_DEADLINE_MS: u64 = 86_400_000; // 24 hours

fun init(ctx: &mut TxContext) {
    let admin_cap = caps::create_admin_cap(ctx);
    let oracle_cap = caps::create_oracle_cap(ctx);
    let config = Config {
        id: object::new(ctx),
        protocol_fee_bps: DEFAULT_PROTOCOL_FEE_BPS,
        min_stake: DEFAULT_MIN_STAKE,
        max_stake: DEFAULT_MAX_STAKE,
        lock_before_deadline_ms: DEFAULT_LOCK_BEFORE_DEADLINE_MS,
        current_epoch_id: 0,
    };
    let pool = community_pool::create(ctx);

    caps::transfer_admin_cap(admin_cap, ctx.sender());
    caps::transfer_oracle_cap(oracle_cap, ctx.sender());
    transfer::share_object(config);
    community_pool::share(pool);
}

public fun protocol_fee_bps(config: &Config): u64 {
    config.protocol_fee_bps
}

public fun min_stake(config: &Config): u64 {
    config.min_stake
}

public fun max_stake(config: &Config): u64 {
    config.max_stake
}

public fun lock_before_deadline_ms(config: &Config): u64 {
    config.lock_before_deadline_ms
}

public fun current_epoch_id(config: &Config): u64 {
    config.current_epoch_id
}

public entry fun update_protocol_fee(
    _admin: &AdminCap,
    config: &mut Config,
    fee_bps: u64,
) {
    assert!(fee_bps <= 10_000, EInvalidFee);
    config.protocol_fee_bps = fee_bps;
}

public entry fun update_stake_bounds(
    _admin: &AdminCap,
    config: &mut Config,
    min_stake: u64,
    max_stake: u64,
) {
    assert!(min_stake <= max_stake, EInvalidStakeBounds);
    config.min_stake = min_stake;
    config.max_stake = max_stake;
}

public entry fun advance_epoch(
    _admin: &AdminCap,
    config: &mut Config,
    pool: &mut CommunityPool,
    ctx: &mut TxContext,
) {
    config.current_epoch_id = config.current_epoch_id + 1;
    community_pool::advance_epoch(pool, config.current_epoch_id, ctx);
}

#[error]
const EInvalidFee: vector<u8> = b"Protocol fee must be at most 10000 bps";
#[error]
const EInvalidStakeBounds: vector<u8> = b"Min stake must not exceed max stake";

#[test_only]
public fun share_config_for_testing(config: Config) {
    transfer::share_object(config);
}

#[test_only]
public fun init_for_testing(ctx: &mut TxContext): (AdminCap, OracleCap, Config, CommunityPool) {
    let admin_cap = caps::create_admin_cap(ctx);
    let oracle_cap = caps::create_oracle_cap(ctx);
    let config = Config {
        id: object::new(ctx),
        protocol_fee_bps: DEFAULT_PROTOCOL_FEE_BPS,
        min_stake: DEFAULT_MIN_STAKE,
        max_stake: DEFAULT_MAX_STAKE,
        lock_before_deadline_ms: DEFAULT_LOCK_BEFORE_DEADLINE_MS,
        current_epoch_id: 0,
    };
    let pool = community_pool::create(ctx);
    (admin_cap, oracle_cap, config, pool)
}
