module sparky::market;

use sparky::admin::Config;
use sparky::caps::OracleCap;
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;
use sui::object::{Self, ID, UID};
use sui::sui::SUI;
use sui::table::{Self, Table};
use sui::transfer;
use sui::tx_context::TxContext;

const BPS: u64 = 10_000;

public enum BetSide has copy, drop, store {
    Yes,
    No,
}

public enum MarketStatus has copy, drop, store {
    Open,
    Locked,
    Resolved,
}

public struct Position has store {
    side: BetSide,
    amount: u64,
    claimed: bool,
}

/// One pari-mutuel market per public goal.
public struct Market has key {
    id: UID,
    goal_id: ID,
    goal_owner: address,
    lock_at: u64,
    status: MarketStatus,
    /// `true` = YES wins (goal succeeded), `false` = NO wins.
    outcome: Option<bool>,
    yes_pool: Balance<SUI>,
    no_pool: Balance<SUI>,
    positions: Table<address, Position>,
}

public struct MarketCreated has copy, drop {
    market_id: ID,
    goal_id: ID,
    goal_owner: address,
    lock_at: u64,
}

public struct BetPlaced has copy, drop {
    market_id: ID,
    goal_id: ID,
    bettor: address,
    side: u8,
    amount: u64,
    yes_pool: u64,
    no_pool: u64,
}

public struct MarketLocked has copy, drop {
    market_id: ID,
    goal_id: ID,
    yes_pool: u64,
    no_pool: u64,
}

public struct MarketResolved has copy, drop {
    market_id: ID,
    goal_id: ID,
    yes_wins: bool,
    yes_pool: u64,
    no_pool: u64,
}

public struct WinningsClaimed has copy, drop {
    market_id: ID,
    goal_id: ID,
    bettor: address,
    payout: u64,
}

public(package) fun create(
    goal_id: ID,
    goal_owner: address,
    lock_at: u64,
    ctx: &mut TxContext,
): Market {
    let market = Market {
        id: object::new(ctx),
        goal_id,
        goal_owner,
        lock_at,
        status: MarketStatus::Open,
        outcome: option::none(),
        yes_pool: balance::zero(),
        no_pool: balance::zero(),
        positions: table::new(ctx),
    };
    event::emit(MarketCreated {
        market_id: object::id(&market),
        goal_id,
        goal_owner,
        lock_at,
    });
    market
}

public(package) fun share(market: Market) {
    transfer::share_object(market);
}

public fun goal_id(market: &Market): ID {
    market.goal_id
}

public fun goal_owner(market: &Market): address {
    market.goal_owner
}

public fun lock_at(market: &Market): u64 {
    market.lock_at
}

public fun status(market: &Market): MarketStatus {
    market.status
}

public fun yes_pool_value(market: &Market): u64 {
    market.yes_pool.value()
}

public fun no_pool_value(market: &Market): u64 {
    market.no_pool.value()
}

public fun outcome_yes_wins(market: &Market): Option<bool> {
    market.outcome
}

entry fun place_bet(
    market: &mut Market,
    payment: Coin<SUI>,
    side: u8,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let bettor = ctx.sender();
    assert!(market.status == MarketStatus::Open, EMarketNotOpen);
    assert!(clock.timestamp_ms() < market.lock_at, EMarketLocked);
    assert!(bettor != market.goal_owner, EGoalOwnerCannotBet);

    let amount = payment.value();
    assert!(amount > 0, EZeroBet);
    let bet_side = side_from_u8(side);

    if (table::contains(&market.positions, bettor)) {
        let pos = table::borrow_mut(&mut market.positions, bettor);
        assert!(!pos.claimed, EAlreadyClaimed);
        assert!(pos.side == bet_side, EOppositeSideBet);
        pos.amount = pos.amount + amount;
    } else {
        table::add(
            &mut market.positions,
            bettor,
            Position { side: bet_side, amount, claimed: false },
        );
    };

    if (bet_side == BetSide::Yes) {
        market.yes_pool.join(payment.into_balance());
    } else {
        market.no_pool.join(payment.into_balance());
    };

    event::emit(BetPlaced {
        market_id: object::id(market),
        goal_id: market.goal_id,
        bettor,
        side,
        amount,
        yes_pool: market.yes_pool.value(),
        no_pool: market.no_pool.value(),
    });
}

entry fun lock(market: &mut Market, clock: &Clock) {
    assert!(market.status == MarketStatus::Open, EMarketNotOpen);
    assert!(clock.timestamp_ms() >= market.lock_at, ETooEarlyToLock);
    market.status = MarketStatus::Locked;
    event::emit(MarketLocked {
        market_id: object::id(market),
        goal_id: market.goal_id,
        yes_pool: market.yes_pool.value(),
        no_pool: market.no_pool.value(),
    });
}

entry fun resolve(
    _oracle: &OracleCap,
    market: &mut Market,
    goal_success: bool,
) {
    assert!(market.status == MarketStatus::Locked, EMarketNotLocked);
    market.status = MarketStatus::Resolved;
    market.outcome = option::some(goal_success);
    event::emit(MarketResolved {
        market_id: object::id(market),
        goal_id: market.goal_id,
        yes_wins: goal_success,
        yes_pool: market.yes_pool.value(),
        no_pool: market.no_pool.value(),
    });
}

entry fun claim(
    market: &mut Market,
    config: &Config,
    ctx: &mut TxContext,
) {
    let coin = compute_claim(market, config, ctx);
    transfer::public_transfer(coin, ctx.sender());
}

fun compute_claim(
    market: &mut Market,
    config: &Config,
    ctx: &mut TxContext,
): Coin<SUI> {
    assert!(market.status == MarketStatus::Resolved, EMarketNotResolved);
    let yes_wins = *market.outcome.borrow();
    let bettor = ctx.sender();

    assert!(table::contains(&market.positions, bettor), ENoPosition);
    let pos = table::borrow_mut(&mut market.positions, bettor);
    assert!(!pos.claimed, EAlreadyClaimed);

    let won = (yes_wins && pos.side == BetSide::Yes) ||
        (!yes_wins && pos.side == BetSide::No);
    assert!(won, ENotWinner);

    let s = pos.amount;
    let (win_pool_ref, lose_pool_ref) = if (yes_wins) {
        (&mut market.yes_pool, &mut market.no_pool)
    } else {
        (&mut market.no_pool, &mut market.yes_pool)
    };

    let w_total = win_pool_ref.value();
    let l_total = lose_pool_ref.value();
    assert!(w_total >= s, EPoolInvariant);

    let bonus = if (l_total == 0 || w_total == 0) {
        0
    } else {
        let fee_bps = config.protocol_fee_bps();
        let numerator =
            (s as u128) * (l_total as u128) * ((BPS - fee_bps) as u128);
        let denominator = (w_total as u128) * (BPS as u128);
        (numerator / denominator as u64)
    };

    let mut payout = win_pool_ref.split(s);
    if (bonus > 0) {
        payout.join(lose_pool_ref.split(bonus));
    };

    let payout_amount = payout.value();
    pos.claimed = true;

    event::emit(WinningsClaimed {
        market_id: object::id(market),
        goal_id: market.goal_id,
        bettor,
        payout: payout_amount,
    });

    coin::from_balance(payout, ctx)
}

fun side_from_u8(side: u8): BetSide {
    assert!(side <= 1, EInvalidSide);
    if (side == 0) {
        BetSide::Yes
    } else {
        BetSide::No
    }
}

#[error]
const EMarketNotOpen: vector<u8> = b"Market is not accepting bets";
#[error]
const EMarketLocked: vector<u8> = b"Market betting period has ended";
#[error]
const EGoalOwnerCannotBet: vector<u8> = b"Goal owner cannot bet on their own market";
#[error]
const EZeroBet: vector<u8> = b"Bet amount must be positive";
#[error]
const EOppositeSideBet: vector<u8> = b"Bettor already has a position on the opposite side";
#[error]
const EAlreadyClaimed: vector<u8> = b"Winnings already claimed";
#[error]
const ETooEarlyToLock: vector<u8> = b"Cannot lock market before lock_at";
#[error]
const EMarketNotLocked: vector<u8> = b"Market must be locked before resolution";
#[error]
const EMarketNotResolved: vector<u8> = b"Market has not resolved yet";
#[error]
const ENoPosition: vector<u8> = b"No position in this market";
#[error]
const ENotWinner: vector<u8> = b"Bettor did not win this market";
#[error]
const EPoolInvariant: vector<u8> = b"Winning pool smaller than position stake";
#[error]
const EInvalidSide: vector<u8> = b"Side must be 0 (YES) or 1 (NO)";

#[test_only]
public fun create_for_testing(
    goal_id: ID,
    goal_owner: address,
    lock_at: u64,
    ctx: &mut TxContext,
): Market {
    create(goal_id, goal_owner, lock_at, ctx)
}

#[test_only]
public fun share_for_testing(market: Market) {
    transfer::share_object(market);
}

#[test_only]
public fun is_locked(market: &Market): bool {
    market.status == MarketStatus::Locked
}

#[test_only]
public fun resolve_for_testing(market: &mut Market, goal_success: bool) {
    market.status = MarketStatus::Resolved;
    market.outcome = option::some(goal_success);
}
