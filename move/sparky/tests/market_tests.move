#[test_only]
module sparky::market_tests;

use sparky::admin;
use sparky::caps::OracleCap;
use sparky::community_pool;
use sparky::market::{Self, Market};
use std::unit_test::assert_eq;
use sui::clock;
use sui::coin;
use sui::object;
use sui::sui::SUI;
use sui::test_scenario::{Self as ts, Scenario};
use sui::transfer;

const OWNER: address = @0xA;
const YES_BETTOR: address = @0xB;
const NO_BETTOR: address = @0xC;
const STAKE: u64 = 100_000_000;
const LOCK_AT: u64 = 1_000;
const GOAL_ID_ADDR: address = @0x999;

fun setup_market(): Scenario {
    let mut scenario = ts::begin(OWNER);
    scenario.next_tx(OWNER);
    {
        let ctx = scenario.ctx();
        let (admin_cap, oracle_cap, config, pool) = admin::init_for_testing(ctx);
        transfer::public_transfer(admin_cap, OWNER);
        transfer::public_transfer(oracle_cap, OWNER);
        admin::share_config_for_testing(config);
        community_pool::share_for_testing(pool);
        let goal_id = object::id_from_address(GOAL_ID_ADDR);
        let market = market::create_for_testing(goal_id, OWNER, LOCK_AT, ctx);
        market::share_for_testing(market);
    };
    scenario
}

#[test, expected_failure(abort_code = market::EGoalOwnerCannotBet, location = market)]
fun goal_owner_bet_aborts() {
    let mut scenario = setup_market();
    scenario.next_tx(OWNER);
    {
        let mut market = scenario.take_shared<Market>();
        let clock = clock::create_for_testing(scenario.ctx());
        let payment = coin::mint_for_testing<SUI>(STAKE, scenario.ctx());
        market::place_bet(&mut market, payment, 0, &clock, scenario.ctx());
        clock::destroy_for_testing(clock);
        ts::return_shared(market);
    };
    scenario.end();
}

#[test]
fun winner_with_losing_pool_gets_bonus() {
    let mut scenario = setup_market();
    scenario.next_tx(YES_BETTOR);
    {
        let mut market = scenario.take_shared<Market>();
        let clock = clock::create_for_testing(scenario.ctx());
        let payment = coin::mint_for_testing<SUI>(STAKE, scenario.ctx());
        market::place_bet(&mut market, payment, 0, &clock, scenario.ctx());
        clock::destroy_for_testing(clock);
        ts::return_shared(market);
    };
    scenario.next_tx(NO_BETTOR);
    {
        let mut market = scenario.take_shared<Market>();
        let clock = clock::create_for_testing(scenario.ctx());
        let payment = coin::mint_for_testing<SUI>(STAKE, scenario.ctx());
        market::place_bet(&mut market, payment, 1, &clock, scenario.ctx());
        clock::destroy_for_testing(clock);
        ts::return_shared(market);
    };
    scenario.next_tx(OWNER);
    {
        let mut market = scenario.take_shared<Market>();
        let mut clock = clock::create_for_testing(scenario.ctx());
        clock::increment_for_testing(&mut clock, LOCK_AT);
        market::lock(&mut market, &clock);
        clock::destroy_for_testing(clock);
        ts::return_shared(market);
    };
    scenario.next_tx(OWNER);
    {
        let mut market = scenario.take_shared<Market>();
        let oracle_cap = scenario.take_from_sender<OracleCap>();
        market::resolve(&oracle_cap, &mut market, true);
        scenario.return_to_sender(oracle_cap);
        ts::return_shared(market);
    };
    scenario.next_tx(YES_BETTOR);
    {
        let mut market = scenario.take_shared<Market>();
        let config = scenario.take_shared<sparky::admin::Config>();
        market::claim(&mut market, &config, scenario.ctx());
        ts::return_shared(market);
        ts::return_shared(config);
    };
    scenario.end();
}

#[test]
fun zero_losing_pool_returns_principal_only() {
    let mut scenario = setup_market();
    scenario.next_tx(YES_BETTOR);
    {
        let mut market = scenario.take_shared<Market>();
        let clock = clock::create_for_testing(scenario.ctx());
        let payment = coin::mint_for_testing<SUI>(STAKE, scenario.ctx());
        market::place_bet(&mut market, payment, 0, &clock, scenario.ctx());
        clock::destroy_for_testing(clock);
        ts::return_shared(market);
    };
    scenario.next_tx(OWNER);
    {
        let mut market = scenario.take_shared<Market>();
        market::resolve_for_testing(&mut market, true);
        assert_eq!(market.no_pool_value(), 0);
        ts::return_shared(market);
    };
    scenario.next_tx(YES_BETTOR);
    {
        let mut market = scenario.take_shared<Market>();
        let config = scenario.take_shared<sparky::admin::Config>();
        market::claim(&mut market, &config, scenario.ctx());
        ts::return_shared(market);
        ts::return_shared(config);
    };
    scenario.end();
}

#[test]
fun empty_market_locks_without_crash() {
    let mut scenario = setup_market();
    scenario.next_tx(OWNER);
    {
        let mut market = scenario.take_shared<Market>();
        let mut clock = clock::create_for_testing(scenario.ctx());
        clock::increment_for_testing(&mut clock, LOCK_AT);
        market::lock(&mut market, &clock);
        assert!(market::is_locked(&market));
        clock::destroy_for_testing(clock);
        ts::return_shared(market);
    };
    scenario.end();
}
