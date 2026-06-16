module sparky::community_pool;

use sparky::caps::AdminCap;
use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::event;
use sui::object::{Self, UID};
use sui::sui::SUI;
use sui::table::{Self, Table};
use sui::tx_context::TxContext;

/// Platform-wide pool for forfeited personal stakes.
public struct CommunityPool has key {
    id: UID,
    balance: Balance<SUI>,
    current_epoch_id: u64,
    /// Pull-based claims for the active epoch (populated in Phase 3).
    claims: Table<address, u64>,
}

public struct StakeForfeited has copy, drop {
    goal_id: ID,
    owner: address,
    amount: u64,
    epoch_id: u64,
}

public struct EpochPublished has copy, drop {
    epoch_id: u64,
    total_distributed: u64,
}

public struct RewardClaimed has copy, drop {
    epoch_id: u64,
    claimant: address,
    amount: u64,
}

public(package) fun create(ctx: &mut TxContext): CommunityPool {
    CommunityPool {
        id: object::new(ctx),
        balance: balance::zero(),
        current_epoch_id: 0,
        claims: table::new(ctx),
    }
}

public fun balance_value(pool: &CommunityPool): u64 {
    pool.balance.value()
}

public fun current_epoch_id(pool: &CommunityPool): u64 {
    pool.current_epoch_id
}

/// Called by commitment on personal-stake forfeiture.
public(package) fun deposit(
    pool: &mut CommunityPool,
    stake: Balance<SUI>,
    goal_id: ID,
    owner: address,
) {
    let amount = stake.value();
    pool.balance.join(stake);
    event::emit(StakeForfeited {
        goal_id,
        owner,
        amount,
        epoch_id: pool.current_epoch_id,
    });
}

public(package) fun advance_epoch(
    pool: &mut CommunityPool,
    new_epoch_id: u64,
    ctx: &mut TxContext,
) {
    assert!(pool.claims.length() == 0, EUnclaimedRewardsRemain);
    pool.claims.drop();
    pool.claims = table::new(ctx);
    pool.current_epoch_id = new_epoch_id;
}

/// Phase 3: admin publishes off-chain computed shares for the closing epoch.
public entry fun publish_epoch_claims(
    _admin: &AdminCap,
    pool: &mut CommunityPool,
    epoch_id: u64,
    claimants: vector<address>,
    amounts: vector<u64>,
) {
    assert!(epoch_id == pool.current_epoch_id, EWrongEpoch);
    assert!(claimants.length() == amounts.length(), EMismatchedClaimLists);
    assert!(pool.claims.length() == 0, EUnclaimedRewardsRemain);

    let mut total: u64 = 0;
    claimants.length().do!(|i| {
        let claimant = claimants[i];
        let amount = amounts[i];
        assert!(amount > 0, EZeroClaim);
        table::add(&mut pool.claims, claimant, amount);
        total = total + amount;
    });

    event::emit(EpochPublished {
        epoch_id,
        total_distributed: total,
    });
}

public entry fun claim(
    pool: &mut CommunityPool,
    ctx: &mut TxContext,
): Coin<SUI> {
    let claimant = ctx.sender();
    assert!(table::contains(&pool.claims, claimant), ENoClaim);
    let amount = table::remove(&mut pool.claims, claimant);
    assert!(pool.balance.value() >= amount, EInsufficientPoolBalance);
    let coin = coin::from_balance(pool.balance.split(amount), ctx);
    event::emit(RewardClaimed {
        epoch_id: pool.current_epoch_id,
        claimant,
        amount,
    });
    coin
}

#[test_only]
public fun fund_for_testing(pool: &mut CommunityPool, payment: Coin<SUI>) {
    pool.balance.join(payment.into_balance());
}

#[error]
const EWrongEpoch: vector<u8> = b"Epoch id does not match pool current epoch";
#[error]
const EMismatchedClaimLists: vector<u8> = b"Claimants and amounts vectors must match";
#[error]
const EZeroClaim: vector<u8> = b"Claim amount must be positive";
#[error]
const ENoClaim: vector<u8> = b"No claim available for this address";
#[error]
const EInsufficientPoolBalance: vector<u8> = b"Community pool balance too low";
#[error]
const EUnclaimedRewardsRemain: vector<u8> = b"All epoch claims must be consumed before advancing";
