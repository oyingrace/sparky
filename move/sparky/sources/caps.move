module sparky::caps;

use sui::object::{Self, UID};
use sui::transfer;
use sui::tx_context::TxContext;

public struct AdminCap has key, store {
    id: UID,
}

public struct OracleCap has key, store {
    id: UID,
}

public(package) fun create_admin_cap(ctx: &mut TxContext): AdminCap {
    AdminCap { id: object::new(ctx) }
}

public(package) fun create_oracle_cap(ctx: &mut TxContext): OracleCap {
    OracleCap { id: object::new(ctx) }
}

public(package) fun transfer_admin_cap(cap: AdminCap, recipient: address) {
    transfer::transfer(cap, recipient);
}

public(package) fun transfer_oracle_cap(cap: OracleCap, recipient: address) {
    transfer::transfer(cap, recipient);
}

public fun assert_oracle(_cap: &OracleCap) {}
