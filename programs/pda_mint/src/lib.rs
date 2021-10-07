use anchor_lang::{prelude::*, solana_program::{program_pack::Pack}};
use spl_token::{instruction::{AuthorityType}, state::Mint};
use anchor_spl::token::{self, Token, Mint as MintAccount, MintTo, TokenAccount, SetAuthority};

//i cleaned up from the git ignore
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
const AUTH_PDA_SEED: &[u8] = b"authority";

#[program]
pub mod pda_mint {
    use super::*;
    pub fn create_pack(ctx: Context<CreatePack>, _auth_pda_bump: u8) -> ProgramResult {
        //do the metadata

        let (_pda, bump_seed) = Pubkey::find_program_address(&[AUTH_PDA_SEED], ctx.program_id);
        let seeds = &[&AUTH_PDA_SEED[..], &[bump_seed]];

        //make sure the pda has mint authority and freeze authority before minting
        verify_incoming_mint(ctx.accounts.mint.to_account_info(), _pda)?;

        //mint to the user's token account
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.mint_auth.to_account_info()
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::mint_to(CpiContext::new_with_signer(cpi_program, cpi_accounts, &[&seeds[..]]), 1)?;

        Ok(())
    }
    //pub fn join_pack
    pub fn join_pack(ctx: Context<JoinPack>, _auth_pda_bump: u8) -> ProgramResult {
        //charge a small fee? -- idk maybe not on this one. enough to discourage u from doing it for no reason. idk
        //make sure the supply is > 0 before minting. you have to call create_pack before joining
        let (_pda, bump_seed) = Pubkey::find_program_address(&[AUTH_PDA_SEED], ctx.program_id);
        let seeds = &[&AUTH_PDA_SEED[..], &[bump_seed]];

        //must create before joining
        let mint_supply = Mint::unpack(&ctx.accounts.mint.to_account_info().data.borrow())?.supply;
        if mint_supply < 1 {
            msg!("must create before joining");
            return Err(ErrorCode::JoinBeforeCreate.into());
        }

        //make sure the pda has mint authority and freeze authority before minting
        verify_incoming_mint(ctx.accounts.mint.to_account_info(), _pda)?;

        //mint to the user's token account
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.mint_auth.to_account_info()
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::mint_to(CpiContext::new_with_signer(cpi_program, cpi_accounts, &[&seeds[..]]), 1)?;
        
        //check supply -- if greater than 7, freeze
        if mint_supply > 2 {
            freeze_mint_supply(ctx, seeds)?;
        }
        
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(_auth_pda_bump: u8)]
pub struct CreatePack<'info> {
    #[account(mut)]
    mint: Account<'info, MintAccount>,
    #[account(
        seeds = [AUTH_PDA_SEED], 
        bump = _auth_pda_bump,
    )]
    mint_auth: UncheckedAccount<'info>,
    #[account(
        mut,
        has_one = owner
    )]
    token_account: Account<'info, TokenAccount>,
    owner: Signer<'info>,
    token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(_auth_pda_bump: u8)]
pub struct JoinPack<'info> {
    #[account(mut)]
    mint: Account<'info, MintAccount>,
    #[account(
        seeds = [AUTH_PDA_SEED], 
        bump = _auth_pda_bump,
    )]
    mint_auth: UncheckedAccount<'info>,
    #[account(
        mut,
        has_one = owner
    )]
    token_account: Account<'info, TokenAccount>,
    owner: Signer<'info>,
    token_program: Program<'info, Token>,
}

fn verify_incoming_mint(mint: AccountInfo, pda: Pubkey) -> ProgramResult {
    //if freeze authority on the mint is not the pda, don't mint
    let freeze_authority = Mint::unpack(&mint.data.borrow())?.freeze_authority.unwrap();
    if freeze_authority != pda {
        msg!("no freeze control");
        return Err(ErrorCode::NoFreezeControl.into());
    }
    //if mint authority on the mint is not the pda, don't mint
    let mint_authority = Mint::unpack(&mint.data.borrow())?.mint_authority.unwrap();
    if mint_authority != pda {
        msg!("no mint control");
        return Err(ErrorCode::NoMintControl.into());
    }
     Ok(())
}

fn freeze_mint_supply(ctx: Context<JoinPack>, seeds: &[&[u8]; 2]) -> ProgramResult {
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
impl<'info>JoinPack<'info> {
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
    #[msg("cannot join a pack with mint supply 0. create pack first")]
    JoinBeforeCreate,
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
/*

    //test for validation
        //example calling another program in your program
        /*
        let mut tester_accounts = Tester {
            test: ctx.accounts.mint_auth.clone()
        };
        let tester_context = Context::new(ctx.program_id, & mut tester_accounts, &[]);
        tester(tester_context)?;
        */



single program cpi

impl<'info>CreatePack<'info> {
    fn into_mint_one(&self) -> MintOne<'info> {
        MintOne {
            mint: self.mint.clone(),
            mint_auth: self.mint_auth.clone(),
            token_account: self.token_account.clone(),
            owner: self.owner.clone(),
            token_program: self.token_program.clone()
        }
    }
}

*/