#[test_only]
module sparky::goal_tests;

use sparky::admin;
use sparky::caps::OracleCap;
use sparky::commitment::Commitment;
use sparky::community_pool::CommunityPool;
use sparky::goal::{Self, Goal, GoalStatus};
use std::unit_test::assert_eq;
use sui::clock;
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario::{Self as ts, Scenario};
use sui::transfer;

const OWNER: address = @0xA;
const STAKE: u64 = 100_000_000;
const FAR_FUTURE_MS: u64 = 1_000_000_000_000;

fun setup(): Scenario {
    let mut scenario = ts::begin(OWNER);
    scenario.next_tx(OWNER);
    {
        let ctx = scenario.ctx();
        let (admin_cap, oracle_cap, config, pool) = admin::init_for_testing(ctx);
        transfer::public_transfer(admin_cap, OWNER);
        transfer::public_transfer(oracle_cap, OWNER);
        transfer::public_share_object(config);
        transfer::public_share_object(pool);
    };
    scenario
}

#[test]
fun create_goal_deposits_stake() {
    let mut scenario = setup();
    scenario.next_tx(OWNER);
    {
        let config = scenario.take_shared<sparky::admin::Config>();
        let clock = clock::create_for_testing(scenario.ctx());
        let payment = coin::mint_for_testing<SUI>(STAKE, scenario.ctx());
        goal::create_goal(
            &config,
            payment,
            x"deadbeef",
            0,
            FAR_FUTURE_MS,
            false,
            &clock,
            scenario.ctx(),
        );
        clock::destroy_for_testing(clock);
        ts::return_shared(config);
    };
    scenario.next_tx(OWNER);
    {
        let goal = scenario.take_shared<Goal>();
        assert_eq!(goal.owner(), OWNER);
        assert_eq!(goal.status(), GoalStatus::Active);
        assert_eq!(goal.stake_amount(), STAKE);
        ts::return_shared(goal);
    };
    scenario.end();
}

#[test]
fun submit_proof_records_hash() {
    let mut scenario = setup();
    scenario.next_tx(OWNER);
    {
        let config = scenario.take_shared<sparky::admin::Config>();
        let clock = clock::create_for_testing(scenario.ctx());
        let payment = coin::mint_for_testing<SUI>(STAKE, scenario.ctx());
        goal::create_goal(
            &config,
            payment,
            x"deadbeef",
            0,
            FAR_FUTURE_MS,
            false,
            &clock,
            scenario.ctx(),
        );
        clock::destroy_for_testing(clock);
        ts::return_shared(config);
    };
    scenario.next_tx(OWNER);
    {
        let mut goal = scenario.take_shared<Goal>();
        let clock = clock::create_for_testing(scenario.ctx());
        let proof_hash = x"0123456789012345678901234567890123456789012345678901234567890123";
        goal::submit_proof(&mut goal, proof_hash, &clock, scenario.ctx());
        clock::destroy_for_testing(clock);
        ts::return_shared(goal);
    };
    scenario.end();
}

#[test]
fun settle_success_returns_stake() {
    let mut scenario = setup();
    scenario.next_tx(OWNER);
    {
        let config = scenario.take_shared<sparky::admin::Config>();
        let clock = clock::create_for_testing(scenario.ctx());
        let payment = coin::mint_for_testing<SUI>(STAKE, scenario.ctx());
        goal::create_goal(
            &config,
            payment,
            x"deadbeef",
            0,
            FAR_FUTURE_MS,
            false,
            &clock,
            scenario.ctx(),
        );
        clock::destroy_for_testing(clock);
        ts::return_shared(config);
    };
    scenario.next_tx(OWNER);
    {
        let mut goal = scenario.take_shared<Goal>();
        let commitment = scenario.take_shared<Commitment>();
        let mut pool = scenario.take_shared<CommunityPool>();
        let oracle_cap = scenario.take_from_sender<OracleCap>();
        goal::settle_goal(
            &oracle_cap,
            &mut goal,
            commitment,
            &mut pool,
            true,
            scenario.ctx(),
        );
        assert_eq!(goal.status(), GoalStatus::ResolvedSuccess);
        ts::return_shared(goal);
        ts::return_shared(pool);
        scenario.return_to_sender(oracle_cap);
    };
    scenario.end();
}

#[test]
fun settle_failure_forfeits_to_pool() {
    let mut scenario = setup();
    scenario.next_tx(OWNER);
    {
        let config = scenario.take_shared<sparky::admin::Config>();
        let clock = clock::create_for_testing(scenario.ctx());
        let payment = coin::mint_for_testing<SUI>(STAKE, scenario.ctx());
        goal::create_goal(
            &config,
            payment,
            x"deadbeef",
            0,
            FAR_FUTURE_MS,
            false,
            &clock,
            scenario.ctx(),
        );
        clock::destroy_for_testing(clock);
        ts::return_shared(config);
    };
    scenario.next_tx(OWNER);
    {
        let mut goal = scenario.take_shared<Goal>();
        let commitment = scenario.take_shared<Commitment>();
        let mut pool = scenario.take_shared<CommunityPool>();
        let oracle_cap = scenario.take_from_sender<OracleCap>();
        goal::settle_goal(
            &oracle_cap,
            &mut goal,
            commitment,
            &mut pool,
            false,
            scenario.ctx(),
        );
        assert_eq!(pool.balance_value(), STAKE);
        assert_eq!(goal.status(), GoalStatus::ResolvedFailure);
        ts::return_shared(goal);
        ts::return_shared(pool);
        scenario.return_to_sender(oracle_cap);
    };
    scenario.end();
}
