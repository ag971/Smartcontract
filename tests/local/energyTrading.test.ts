import { expect, use } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import {
    findSig,
    MethodCallOptions,
    PubKey,
    PubKeyHash,
    Sig,
    toHex,
    bsv,
    FixedArray,
    getDummySig,
    findSigs,
    Utils,
    slice,
} from 'scrypt-ts'
import { EnergyTrading } from '../../src/contracts/EnergyTrading'
import { getDummySigner, getDummyUTXO } from '../utils/txHelper'

use(chaiAsPromised)

const privateKeys: bsv.PrivateKey[] = []
const publicKeys: bsv.PublicKey[] = []
const addresses: bsv.Address[] = []

for (let i = 0; i < 3; i++) {
    privateKeys.push(bsv.PrivateKey.fromRandom(bsv.Networks.testnet))
    publicKeys.push(privateKeys[i].publicKey)
    addresses.push(privateKeys[i].publicKey.toAddress())
}

describe('Test SmartContract for Energy Trading Platform', () => {
    before(async () => {
        await EnergyTrading.compile()
    })

    it('should pass if using right private keys for trade', async () => {
        const energyTrading = new EnergyTrading(
            addresses.map((addr) => {
                return PubKeyHash(slice(addr.toHex(), 1n)) // Ignore address prefix.
            }) as FixedArray<PubKeyHash, 3>
        )

        // Dummy signer can take an array of signing private keys.
        await energyTrading.connect(getDummySigner(privateKeys))

        const { tx: callTx, atInputIndex } =
            await energyTrading.methods.tradeEnergy(
                // Filter out relevant signatures.
                // Be vary of the order (https://scrypt.io/docs/how-to-write-a-contract/built-ins#checkmultisig).
                (sigResps) => findSigs(sigResps, publicKeys),
                publicKeys.map((publicKey) => PubKey(toHex(publicKey))),
                // Method call options:
                {
                    fromUTXO: getDummyUTXO(),
                    pubKeyOrAddrToSign: publicKeys,
                } as MethodCallOptions<EnergyTrading>
            )

        const result = callTx.verifyScript(atInputIndex)
        expect(result.success, result.error).to.eq(true)
    })

    it('should not pass if using wrong sig for trade', async () => {
        const energyTradingContract = new EnergyTrading(
            addresses.map((addr) => {
                return PubKeyHash(toHex(addr.toHex()))
            }) as FixedArray<PubKeyHash, 3>
        )

        await energyTradingContract.connect(getDummySigner(privateKeys))

        return expect(
            energyTradingContract.methods.tradeEnergy(
                (sigResps) => {
                    const res = findSigs(sigResps, publicKeys)
                    res[0] = getDummySig()
                    return res
                },
                publicKeys.map((publicKey) => PubKey(toHex(publicKey))),
                {
                    fromUTXO: getDummyUTXO(),
                    pubKeyOrAddrToSign: publicKeys,
                } as MethodCallOptions<EnergyTrading>
            )
        ).to.be.rejectedWith(/Execution failed/)
    })
})
