import {
    assert,
    FixedArray,
    method,
    prop,
    PubKeyHash,
    PubKey,
    SmartContract,
    Sig,
    hash160,
    SigHash,
    Utils,
    hash256,
} from 'scrypt-ts'

const LOCKTIME_BLOCK_HEIGHT_MARKER = 500000000
const UINT_MAX = 0xffffffffn

/*
 * An energy trading contract where a list of regulators can resolve a dispute.
 */
export class EnergyTradingContract extends SmartContract {
    static readonly N_REGULATORS = 3

    @prop()
    readonly producerAddr: PubKeyHash

    @prop()
    readonly consumerAddr: PubKeyHash

    @prop()
    readonly regulators: FixedArray<
        PubKey,
        typeof EnergyTradingContract.N_REGULATORS
    >

    @prop()
    readonly deadline: bigint

    @prop()
    readonly minimumEnergyAmount: bigint

    constructor(
        producerAddr: PubKeyHash,
        consumerAddr: PubKeyHash,
        regulators: FixedArray<
            PubKey,
            typeof EnergyTradingContract.N_REGULATORS
        >,
        deadline: bigint,
        minimumEnergyAmount: bigint
    ) {
        super(...arguments)
        this.producerAddr = producerAddr
        this.consumerAddr = consumerAddr
        this.regulators = regulators
        this.deadline = deadline
        this.minimumEnergyAmount = minimumEnergyAmount
    }

    // Consumer and regulators confirm that the energy was delivered.
    // Producer gets paid.
    @method(SigHash.ANYONECANPAY_SINGLE)
    public confirmTrade(
        consumerSig: Sig,
        consumerPubKey: PubKey,
        regulatorSigs: FixedArray<
            Sig,
            typeof EnergyTradingContract.N_REGULATORS
        >,
        energyAmount: bigint
    ) {
        // Validate consumer sig.
        assert(
            hash160(consumerPubKey) == this.consumerAddr,
            'invalid public key for consumer'
        )
        assert(
            this.checkSig(consumerSig, consumerPubKey),
            'consumer signature check failed'
        )

        // Validate regulator sigs.
        assert(
            this.checkMultiSig(regulatorSigs, this.regulators),
            'regulators checkMultiSig failed'
        )

        // Ensure producer gets paid and minimum energy amount is met.
        const amount = this.ctx.utxo.value
        const out = Utils.buildPublicKeyHashOutput(this.producerAddr, amount)
        assert(hash256(out) == this.ctx.hashOutputs, 'hashOutputs mismatch')
        assert(
            energyAmount >= this.minimumEnergyAmount,
            'minimum energy not met'
        )
    }

    // Regular trade cancellation. Needs regulators agreement.
    @method()
    public cancelTrade(
        consumerSig: Sig,
        consumerPubKey: PubKey,
        regulatorSigs: FixedArray<
            Sig,
            typeof EnergyTradingContract.N_REGULATORS
        >,
        energyAmount: bigint
    ) {
        // Validate consumer sig.
        assert(
            hash160(consumerPubKey) == this.consumerAddr,
            'invalid public key for consumer'
        )
        assert(
            this.checkSig(consumerSig, consumerPubKey),
            'consumer signature check failed'
        )

        // Validate regulator sigs.
        assert(
            this.checkMultiSig(regulatorSigs, this.regulators),
            'regulators checkMultiSig failed'
        )

        // Ensure consumer gets refund and minimum energy amount is met.
        const amount = this.ctx.utxo.value
        const out = Utils.buildPublicKeyHashOutput(this.consumerAddr, amount)
        assert(hash256(out) == this.ctx.hashOutputs, 'hashOutputs mismatch')
        assert(
            energyAmount >= this.minimumEnergyAmount,
            'minimum energy not met'
        )
    }

    // Deadline for delivery. If reached, the consumer gets refunded.
    @method()
    public refundDeadline(consumerSig: Sig, consumerPubKey: PubKey) {
        assert(
            hash160(consumerPubKey) == this.consumerAddr,
            'invalid public key for consumer'
        )
        assert(
            this.checkSig(consumerSig, consumerPubKey),
            'consumer signature check failed'
        )

        // Require nLocktime enabled
        assert(this.ctx.sequence < UINT_MAX, 'require nLocktime enabled')

        // Check if using block height.
        if (this.deadline < LOCKTIME_BLOCK_HEIGHT_MARKER) {
            // Enforce nLocktime field to also use block height.
            assert(this.ctx.locktime < LOCKTIME_BLOCK_HEIGHT_MARKER)
        }
        assert(this.ctx.locktime >= this.deadline, 'deadline not yet reached')

        // Ensure consumer gets refund.
        const amount = this.ctx.utxo.value
        const out = Utils.buildPublicKeyHashOutput(this.consumerAddr, amount)
        assert(hash256(out) == this.ctx.hashOutputs, 'hashOutputs mismatch')
    }
}
