module sparky::goal;

use sparky::caps::{Self, OracleCap};
use sparky::admin::Config;
use sparky::commitment::{Self, Commitment};
use sparky::community_pool::CommunityPool;
use sui::clock::Clock;
use sui::coin::Coin;
use sui::event;
use sui::object::{Self, ID, UID};
use sui::sui::SUI;
use sui::transfer;
use sui::tx_context::TxContext;

public enum GoalStatus has copy, drop, store {
    Active,
    ResolvedSuccess,
    ResolvedFailure,
}

public enum ProofType has copy, drop, store {
    Photo,
    Gps,
    Webhook,
}

public struct Goal has key {
    id: UID,
    owner: address,
    description_hash: vector<u8>,
    proof_type: ProofType,
    deadline: u64,
    lock_at: u64,
    status: GoalStatus,
    is_public: bool,
    proof_hash: Option<vector<u8>>,
    stake_amount: u64,
}

public struct GoalCreated has copy, drop {
    goal_id: ID,
    owner: address,
    description_hash: vector<u8>,
    proof_type: u8,
    deadline: u64,
    lock_at: u64,
    stake_amount: u64,
    is_public: bool,
}

public struct ProofSubmitted has copy, drop {
    goal_id: ID,
    owner: address,
    proof_hash: vector<u8>,
}

public struct GoalResolved has copy, drop {
    goal_id: ID,
    owner: address,
    success: bool,
}

public entry fun create_goal(
    config: &Config,
    payment: Coin<SUI>,
    description_hash: vector<u8>,
    proof_type: u8,
    deadline: u64,
    is_public: bool,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let stake_amount = payment.value();
    assert!(stake_amount >= config.min_stake(), EStakeTooLow);
    assert!(stake_amount <= config.max_stake(), EStakeTooHigh);
    assert!(deadline > clock.timestamp_ms(), EDeadlineInPast);

    let lock_at = deadline - config.lock_before_deadline_ms();
    assert!(lock_at > clock.timestamp_ms(), ELockAtInPast);

    let owner = ctx.sender();
    let proof_type_enum = proof_type_from_u8(proof_type);

    let goal = Goal {
        id: object::new(ctx),
        owner,
        description_hash,
        proof_type: proof_type_enum,
        deadline,
        lock_at,
        status: GoalStatus::Active,
        is_public,
        proof_hash: option::none(),
        stake_amount,
    };
    let goal_id = object::id(&goal);

    let commitment = commitment::create(goal_id, owner, payment, ctx);

    event::emit(GoalCreated {
        goal_id,
        owner,
        description_hash: goal.description_hash,
        proof_type,
        deadline,
        lock_at,
        stake_amount,
        is_public,
    });

    transfer::share_object(goal);
    transfer::share_object(commitment);
}

public entry fun submit_proof(
    goal: &mut Goal,
    proof_hash: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(goal.status == GoalStatus::Active, EGoalNotActive);
    assert!(goal.owner == ctx.sender(), ENotGoalOwner);
    assert!(clock.timestamp_ms() <= goal.deadline, EPastDeadline);
    assert!(proof_hash.length() == 32, EInvalidProofHash);

    goal.proof_hash = option::some(proof_hash);
    event::emit(ProofSubmitted {
        goal_id: object::id(goal),
        owner: goal.owner,
        proof_hash,
    });
}

public entry fun settle_goal(
    _oracle: &OracleCap,
    goal: &mut Goal,
    commitment: Commitment,
    pool: &mut CommunityPool,
    success: bool,
    ctx: &mut TxContext,
) {
    caps::assert_oracle(_oracle);
    assert!(goal.status == GoalStatus::Active, EGoalNotActive);
    assert!(commitment.goal_id() == object::id(goal), ECommitmentMismatch);
    assert!(commitment.stake_amount() == goal.stake_amount, EStakeMismatch);

    goal.status = if (success) {
        GoalStatus::ResolvedSuccess
    } else {
        GoalStatus::ResolvedFailure
    };

    if (success) {
        commitment::return_stake(commitment, ctx);
    } else {
        commitment::forfeit(commitment, pool);
    };

    event::emit(GoalResolved {
        goal_id: object::id(goal),
        owner: goal.owner,
        success,
    });
}

public fun status(goal: &Goal): GoalStatus {
    goal.status
}

public fun owner(goal: &Goal): address {
    goal.owner
}

public fun deadline(goal: &Goal): u64 {
    goal.deadline
}

public fun lock_at(goal: &Goal): u64 {
    goal.lock_at
}

public fun stake_amount(goal: &Goal): u64 {
    goal.stake_amount
}

fun proof_type_from_u8(proof_type: u8): ProofType {
    assert!(proof_type <= 2, EInvalidProofType);
    if (proof_type == 0) {
        ProofType::Photo
    } else if (proof_type == 1) {
        ProofType::Gps
    } else {
        ProofType::Webhook
    }
}

#[error]
const EStakeTooLow: vector<u8> = b"Stake below minimum";
#[error]
const EStakeTooHigh: vector<u8> = b"Stake above maximum";
#[error]
const EDeadlineInPast: vector<u8> = b"Deadline must be in the future";
#[error]
const ELockAtInPast: vector<u8> = b"Lock time must be in the future";
#[error]
const EGoalNotActive: vector<u8> = b"Goal is not active";
#[error]
const ENotGoalOwner: vector<u8> = b"Only the goal owner may submit proof";
#[error]
const EPastDeadline: vector<u8> = b"Cannot submit proof after deadline";
#[error]
const EInvalidProofHash: vector<u8> = b"Proof hash must be 32 bytes (SHA-256)";
#[error]
const ECommitmentMismatch: vector<u8> = b"Commitment does not belong to this goal";
#[error]
const EStakeMismatch: vector<u8> = b"Commitment stake does not match goal";
#[error]
const EInvalidProofType: vector<u8> = b"Proof type must be 0 (Photo), 1 (Gps), or 2 (Webhook)";
