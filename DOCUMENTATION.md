# Documentation For SubRefill

## Overview

Subrefill is a marketplace that lets users buy mobile airtime and data bundles using cryptocurrency. It focuses on Nigerian mobile networks and enables seamless conversion of crypto assets into prepaid airtime or data plans.

The platform bridges traditional telecom top-ups (VTU-style services) with crypto payments using a p2p model, making it easy for Verse and other crypto holders to stay connected without needing fiat bank transfers or local currency wallets for every transaction.

Primary use cases:

- data bundles bill payment
- airtime bill payment
- Paying with supported (verse, solana, usdt,…) cryptocurrencies

## Key Features

- Crypto payments: Pay directly with supported cryptocurrencies
- Network coverage: MTN, Airtel, Glo, and T2Mobile (9mobile)
- Data bundles: Including daily, weekly, & monthly data plans
- Airtime top-ups: near-instant delivery
- Marketplace model: Simple interface for selecting network, plan/amount, and phone number
- Convenience for crypto users: No need to off-ramp to fiat first plus no sign up required

## Supported Bill Payment Networks

| Network | Airtime | Data Bundles |
| --- | --- | --- |
| MTN | Yes | Yes |
| Airtel | Yes | Yes |
| Glo | Yes | Yes |
| T2Mobile | Yes | Yes |

Note: Specific plan details, pricing, and availability can change. Always check the live rates for current offerings.

## Supported Cryptocurrencies

Confirmed payment options include:

- Verse
- Solana (SOL)
- USDT (Solana SPL, BEP20, Polygon)
- Additional cryptocurrencies (as listed on the platform)

The exact list of accepted coins/tokens and networks may expand over time. Check the payment section on the website for the latest options.

## How It Works (User Guide)

- Visit [https://subrefill.com/](https://subrefill.com/).
- Select the service type (Airtime or Data).
- Choose the network (MTN, Airtel, Glo, or T2Mobile).
- Enter the recipient phone number.
- Select the desired amount or data bundle (e.g., weekly data plan).
- Choose your preferred cryptocurrency for payment.
- Complete the crypto payment (send to the provided address or follow the on-screen instructions).
- Once the payment is confirmed on-chain, the airtime or data is delivered to the phone number.

## Bill Payment Processing Flow

1. Order Placement: The customer selects the desired airtime or data product on Subrefill, enters the recipient phone number, and initiates payment with cryptocurrency.
2. Payment Confirmation: Once the blockchain transaction is detected and a valid transaction hash is received, the order is marked as paid.
3. Order Collection & Notification: Subrefill uses Resend to collect and handle the confirmed order. Upon receiving a valid transaction hash, Resend automatically forwards the complete order details (network, product/plan, phone number, amount, transaction hash, and any other relevant data) to the designated merchant/processor.
4. Merchant Fulfillment: The merchant receives the order details and processes the actual bill payment (airtime top-up or data subscription) with the respective mobile network operator.
5. Delivery Confirmation: Once the airtime or data is successfully delivered to the phone number, the order status is updated.

This flow ensures crypto payment confirmation and order processing while keeping the system auditable via the transaction hash.
