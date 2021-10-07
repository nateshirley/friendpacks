use anchor_lang::{prelude::*, solana_program::{program::invoke_signed, program_pack::Pack}};
use spl_token::{instruction::{mint_to_checked, AuthorityType}, state::Mint};
use anchor_spl::token::{self, Token, Mint as MintAccount, MintTo, TokenAccount, SetAuthority};

//i cleaned up from the git ignore
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
const AUTH_PDA_SEED: &[u8] = b"authority";

#[program]
pub mod pda_mint {
    use super::*;
    pub fn create_pack(ctx: Context<CreatePack>, auth_bump: u8) -> ProgramResult {
        //test for validation
        //example calling another program in your program
        /*
        let mut tester_accounts = Tester {
            test: ctx.accounts.mint_auth.clone()
        };
        let tester_context = Context::new(ctx.program_id, & mut tester_accounts, &[]);
        tester(tester_context)?;
        */
        Ok(())
    }
    pub fn mint_one(ctx: Context<MintOne>, auth_pda_bump: u8) -> ProgramResult {
        //charge a small fee? -- idk maybe not on this one. enough to discourage u from doing it for no reason. idk

        //if freeze authority on the mint is not the pda, don't mint
        let freeze_authority = Mint::unpack(&ctx.accounts.mint.to_account_info().data.borrow())?.freeze_authority.unwrap();
        if freeze_authority != *ctx.accounts.mint_auth.key {
            return Err(ErrorCode::NoFreezeControl.into());
        }
        //if mint authority on the mint is not the pda, don't mint
        let mint_authority = Mint::unpack(&ctx.accounts.mint.to_account_info().data.borrow())?.mint_authority.unwrap();
        if mint_authority != *ctx.accounts.mint_auth.key {
            return Err(ErrorCode::NoMintControl.into());
        }

    
        let (_pda, bump_seed) = Pubkey::find_program_address(&[AUTH_PDA_SEED], ctx.program_id);
        let seeds = &[&AUTH_PDA_SEED[..], &[bump_seed]];
        
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.mint_auth.to_account_info()
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::mint_to(CpiContext::new_with_signer(cpi_program, cpi_accounts, &[&seeds[..]]), 1)?;
        
        //check supply -- if greater than 7, freeze
        let mint_supply = Mint::unpack(&ctx.accounts.mint.to_account_info().data.borrow())?.supply;
        if mint_supply > 0 {
            freeze_mint_supply(ctx, seeds)?;
        }
        
        Ok(())
    }

}

#[derive(Accounts)]
#[instruction(auth_bump: u8)]
pub struct CreatePack<'info> {
    #[account(
        seeds = [AUTH_PDA_SEED], 
        bump = auth_bump,
    )]
    mint_auth: AccountInfo<'info>,
    payer: Signer<'info>
}

#[derive(Accounts)]
#[instruction(auth_pda_bump: u8)]
pub struct MintOne<'info> {
    #[account(mut)]
    mint: Account<'info, MintAccount>,
    #[account(
        seeds = [AUTH_PDA_SEED], 
        bump = auth_pda_bump,
    )]
    mint_auth: UncheckedAccount<'info>,
    #[account(
        mut,
        has_one = owner
    )]
    token_account: Account<'info, TokenAccount>,
    token_program: Program<'info, Token>,
    owner: Signer<'info>,
}

fn freeze_mint_supply(ctx: Context<MintOne>, seeds: &[&[u8]; 2]) -> ProgramResult {
    token::set_authority(
        ctx.accounts.into_freeze_mint_supply_context()
        .with_signer(&[&seeds[..]]),
        AuthorityType::MintTokens,
        None
    )?;
    //not sure if i'm doing this right
    emit!(FreezeMint {
        mint: *ctx.accounts.mint.to_account_info().key,
        label: "this mint has been frozen".to_string(),
    });
    Ok(())
}
impl<'info>MintOne<'info> {
    fn into_freeze_mint_supply_context(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_accounts = SetAuthority {
            current_authority: self.mint_auth.to_account_info(),
            account_or_mint: self.mint.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[event]
pub struct FreezeMint {
    pub mint: Pubkey,
    #[index]
    pub label: String,
}

#[error]
pub enum ErrorCode {
    #[msg("mint auth must be the pack authority pda")]
    NoMintControl,
    #[msg("mint's freeze auth must be the pack authority pda")]
    NoFreezeControl,
}



//vanilla mint example
        /*
        let mint_infos = vec![
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.token_account.to_account_info(),
            ctx.accounts.mint_auth.to_account_info(),
            ctx.accounts.mint_auth.to_account_info(),
        ];
        //https://docs.rs/spl-token/3.2.0/src/spl_token/instruction.rs.html#1075-1103
        let mint_instruction = mint_to_checked(
            ctx.accounts.token_program.key,
            &ctx.accounts.mint.key(),
            &ctx.accounts.token_account.key(),
            ctx.accounts.mint_auth.key,
            &[ctx.accounts.mint_auth.key],
            1,
            0
        )?;
        invoke_signed(
            &mint_instruction, 
            mint_infos.as_slice(), 
            &[&seeds[..]]
        )?;
        */