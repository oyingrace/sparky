#[test_only]
module sparky::community_pool_tests;

use sparky::admin;
use sparky::caps::AdminCap;
use sparky::community_pool::{Self, CommunityPool};
use std::unit_test::assert_eq;
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario::{Self as ts, Scenario};
use sui::transfer;

const ADMIN: address = @0xA;
const USER: address = @0xB;

fun setup(): Scenario {
    let mut scenario = ts::begin(ADMIN);
    scenario.next_tx(ADMIN);
    {
        let ctx = scenario.ctx();
        let (admin_cap, oracle_cap, config, pool) = admin::init_for_testing(ctx);
        transfer::public_transfer(admin_cap, ADMIN);
        transfer::public_transfer(oracle_cap, ADMIN);
        admin::share_config_for_testing(config);
        community_pool::share_for_testing(pool);
    };
    scenario
}

#[test]
fun publish_and_claim_epoch_reward() {
    let mut scenario = setup();
    scenario.next_tx(ADMIN);
    {
        let admin_cap = scenario.take_from_sender<AdminCap>();
        let mut pool = scenario.take_shared<CommunityPool>();
        let ctx = scenario.ctx();
        let deposit = coin::mint_for_testing<SUI>(100_000_000, ctx);
        community_pool::fund_for_testing(&mut pool, deposit);
        community_pool::publish_epoch_claims(
            &admin_cap,
            &mut pool,
            0,
            vector[USER],
            vector[50_000_000],
        );
        scenario.return_to_sender(admin_cap);
        ts::return_shared(pool);
    };
    scenario.next_tx(USER);
    {
        let mut pool = scenario.take_shared<CommunityPool>();
        let ctx = scenario.ctx();
        let reward = community_pool::claim(&mut pool, ctx);
        assert_eq!(reward.value(), 50_000_000);
        coin::burn_for_testing(reward);
        ts::return_shared(pool);
    };
    scenario.end();
}

#[test, expected_failure(abort_code = community_pool::ENoClaim, location = community_pool)]
fun claim_without_entry_aborts() {
    let mut scenario = setup();
    scenario.next_tx(USER);
    {
        let mut pool = scenario.take_shared<CommunityPool>();
        let ctx = scenario.ctx();
        let reward = community_pool::claim(&mut pool, ctx);
        coin::burn_for_testing(reward);
        ts::return_shared(pool);
    };
    scenario.end();
}
