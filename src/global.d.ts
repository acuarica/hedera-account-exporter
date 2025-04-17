
export interface Transaction {

    bytes: string | null
    charged_tx_fee: number
    consensus_timestamp: string
    entity_id: string | null           // Network entity ID in the format of shard.realm.num
    max_fee: string
    memo_base64: string | null         // To be checked
    // name: TransactionType
    // nft_transfers: NftTransfer[]
    node: string | null                // Network entity ID in the format of shard.realm.num
    nonce: number
    parent_consensus_timestamp: string | null
    result: string
    scheduled: boolean
    staking_reward_transfers: StakingRewardTransfer[]
    // token_transfers: TokenTransfer[]
    transaction_hash: string
    transaction_id: string
    transfers: Transfer[]
    valid_duration_seconds: string
    valid_start_timestamp: string
}

export interface Transfer {
    account: string | null                          // Network entity ID in the format of shard.realm.num
    amount: number
    is_approval: boolean | undefined
}

export interface StakingRewardTransfer {
    account: string | null                          // Network entity ID in the format of shard.realm.num
    amount: number
}
