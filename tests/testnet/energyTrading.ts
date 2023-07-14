import { EnergyTrading } from '../../src/contracts/EnergyTrading'
import { getDefaultSigner, inputSatoshis } from '../utils/txHelper'
import { toByteString, sha256 } from 'scrypt-ts'

const message = 'hello world, sCrypt!'

async function main() {
    await EnergyTrading.compile()
    const instance = new EnergyTrading(sha256(toByteString(message, true)))

    // connect to a signer
    await instance.connect(getDefaultSigner())

    // contract deployment
    const deployTx = await instance.deploy(inputSatoshis)
    console.log('EnergyTrading contract deployed: ', deployTx.id)

    // contract call
    const { tx: callTx } = await instance.methods.unlock(
        toByteString(message, true)
    )
    console.log('EnergyTrading contract `unlock` called: ', callTx.id)
}

describe('Test SmartContract `EnergyTrading` on testnet', () => {
    it('should succeed', async () => {
        await main()
    })
})
