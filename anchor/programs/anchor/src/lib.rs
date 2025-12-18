use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_instruction;

declare_id!("EHfsAqymJNvS2WY27PppSxXCnX6tJsCifCr3hAi7r5fb");

#[program]
pub mod anchor {
    use super::*;

    pub fn init_asset(ctx: Context<InitAsset>, price: u64, arweave_id: String) -> Result<()> {
        let asset = &mut ctx.accounts.asset;
        asset.owner = ctx.accounts.creator.key();
        asset.price = price;
        asset.arweave_id = arweave_id;
        asset.bump = ctx.bumps.asset;
        Ok(())
    }

    pub fn buy_asset(ctx: Context<BuyAsset>) -> Result<()> {
        let asset = &ctx.accounts.asset;
        let buyer = &ctx.accounts.buyer;
        let creator = &ctx.accounts.creator;

        // Verify creator matches asset owner
        require_keys_eq!(asset.owner, creator.key());

        // Transfer SOL
        let transfer_instruction = system_instruction::transfer(
            &buyer.key(),
            &creator.key(),
            asset.price,
        );

        anchor_lang::solana_program::program::invoke(
            &transfer_instruction,
            &[
                buyer.to_account_info(),
                creator.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

        // Initialize Access State
        let access_state = &mut ctx.accounts.access_state;
        access_state.asset = asset.key();
        access_state.user = buyer.key();
        access_state.bump = ctx.bumps.access_state;

        Ok(())
    }

    pub fn grant_access(ctx: Context<GrantAccess>) -> Result<()> {
        let asset = &ctx.accounts.asset;
        let creator = &ctx.accounts.creator;
        let user = &ctx.accounts.user;

        // Verify creator matches asset owner
        require_keys_eq!(asset.owner, creator.key());

        // Initialize Access State
        let access_state = &mut ctx.accounts.access_state;
        access_state.asset = asset.key();
        access_state.user = user.key();
        access_state.bump = ctx.bumps.access_state;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(price: u64, arweave_id: String)]
pub struct InitAsset<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + 32 + 8 + 64 + 1, // Discriminator + Pubkey + u64 + String (approx) + Bump
        seeds = [b"asset", creator.key().as_ref(), &arweave_id.as_bytes()[0..32]],
        bump
    )]
    pub asset: Account<'info, Asset>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyAsset<'info> {
    #[account(
        init,
        payer = buyer,
        space = 8 + 32 + 32 + 1, // Discriminator + Asset Key + User Key + Bump
        seeds = [b"access", asset.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub access_state: Account<'info, AccessState>,
    #[account(mut)]
    pub asset: Account<'info, Asset>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    /// CHECK: Verified in instruction logic
    #[account(mut)]
    pub creator: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GrantAccess<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + 32 + 32 + 1,
        seeds = [b"access", asset.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub access_state: Account<'info, AccessState>,
    pub asset: Account<'info, Asset>,
    #[account(mut)]
    pub creator: Signer<'info>,
    /// CHECK: User getting access
    pub user: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Asset {
    pub owner: Pubkey,
    pub price: u64,
    pub arweave_id: String,
    pub bump: u8,
}

#[account]
pub struct AccessState {
    pub asset: Pubkey,
    pub user: Pubkey,
    pub bump: u8,
}
