module sparky::commitment;

use sparky::community_pool::{Self, CommunityPool};
use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::event;
use sui::object::{Self, UID};
use sui::sui::SUI;
use sui::transfer;
use sui::tx_context::TxContext;

/// Personal stake escrow for a single goal — separate from market pools.
public struct Commitment has key {
    id: UID,
    goal_id: ID,
    owner: address,
    stake: Balance<SUI>,
}

public struct StakeDeposited has copy, drop {
    goal_id: ID,
    owner: address,
    amount: u64,
}

public(package) fun create(
    goal_id: ID,
    owner: address,
    payment: Coin<SUI>,
    ctx: &mut TxContext,
): Commitment {
    let amount = payment.value();
    let stake = payment.into_balance();
    event::emit(StakeDeposited { goal_id, owner, amount });
    Commitment {
        id: object::new(ctx),
        goal_id,
        owner,
        stake,
    }
}

public fun stake_amount(commitment: &Commitment): u64 {
    commitment.stake.value()
}

public fun goal_id(commitment: &Commitment): ID {
    commitment.goal_id
}

public(package) fun return_stake(commitment: Commitment, ctx: &mut TxContext) {
    let Commitment { id, goal_id: _, owner, stake } = commitment;
    let coin = coin::from_balance(stake, ctx);
    transfer::public_transfer(coin, owner);
    id.delete();
}

public(package) fun forfeit(
    commitment: Commitment,
    pool: &mut CommunityPool,
) {
    let Commitment { id, goal_id, owner, stake } = commitment;
    community_pool::deposit(pool, stake, goal_id, owner);
    id.delete();
}
