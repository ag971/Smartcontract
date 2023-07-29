import { expect, use } from 'chai';
import { MethodCallOptions, ripemd160, toByteString, PubKey, Sig, getDummySig} from 'scrypt-ts';
import { EnergyTradingEscrow } from '../../src/contracts/energyTrading';
import { getDummySigner, getDummyUTXO } from '../utils/txHelper';
import chaiAsPromised from 'chai-as-promised';
import crypto from 'crypto';

use(chaiAsPromised);

describe('EnergyTradingEscrow SmartContract', () => {
    let instance: EnergyTradingEscrow;

    before(async () => {
        const sellerPubKeyHash = ripemd160(toByteString('seller-pubkey', true));
        const buyerPubKeyHash = ripemd160(toByteString('buyer-pubkey', true));
        const unitPrice = 100n; // Example unitPrice value

        instance = new EnergyTradingEscrow(sellerPubKeyHash, buyerPubKeyHash, unitPrice);
        await instance.connect(getDummySigner());
    });

    it('should allow buying energy with valid signature', async () => {
        // Generate a private key and derive the public key from it
        const buyerPrivateKey = crypto.randomBytes(32); // Replace this with your preferred method of generating a private key
        const buyerPublicKey = crypto.createPublicKey(buyerPrivateKey);

        // Sign a message with the private key to create a signature
        const message = Buffer.from('Buy energy');
        const sign = crypto.createSign('sha256');
        sign.update(message);
        const buyerSignature = sign.sign(buyerPrivateKey);

        // Perform the buyEnergy method call
        const { tx: callTx, atInputIndex } = await instance.methods.buyEnergy(
            buyerPublicKey,
            buyerSignature,
            {
                fromUTXO: getDummyUTXO(),
            } as MethodCallOptions<EnergyTradingEscrow>
        );

        // Verify the result of the script execution
        const result = callTx.verifyScript(atInputIndex);
        expect(result.success, result.error).to.eq(true);
    });

    it('should reject buying energy with wrong signature', async () => {
        // Generate a private key and derive the public key from it
        const buyerPrivateKey = crypto.randomBytes(32);
        const buyerPublicKey = crypto.createPublicKey(buyerPrivateKey);

        // Generate another private key for wrong signature
        const wrongPrivateKey = crypto.randomBytes(32);
        const wrongPublicKey = crypto.createPublicKey(wrongPrivateKey);

        // Sign a message with the wrong private key to create a wrong signature
        const message = Buffer.from('Buy energy');
        const sign = crypto.createSign('sha256');
        sign.update(message);
        const wrongSignature = sign.sign(wrongPrivateKey);

        // Perform the buyEnergy method call with wrong signature
        const { tx: callTx, atInputIndex } = await instance.methods.buyEnergy(
            buyerPublicKey,
            wrongSignature,
            {
                fromUTXO: getDummyUTXO(),
            } as MethodCallOptions<EnergyTradingEscrow>
        );

        // Verify that the script execution fails due to invalid signature
        const result = callTx.verifyScript(atInputIndex);
        expect(result.success).to.eq(false);
        expect(result.error).to.include('Signature verification failed');
    });

});
