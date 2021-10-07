use anchor_lang::{prelude::*, solana_program::{program::invoke_signed, program_pack::Pack}};
use spl_token::{instruction::{mint_to_checked, AuthorityType}, state::Mint};
use anchor_spl::token::{self, Token, SetAuthority};


declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
const VAULT_PDA_SEED: &[u8] = b"authority";

#[program]
pub mod pda_mint {
    use super::*;
    pub fn mint_one(ctx: Context<MintOne>) -> ProgramResult {
        //charge a small fee? -- idk maybe not on this one. enough to discourage u from doing it for no reason. idk
        //verify that the owner actually owns the token account

        let (_pda, bump_seed) = Pubkey::find_program_address(&[VAULT_PDA_SEED], ctx.program_id);
        let seeds = &[&VAULT_PDA_SEED[..], &[bump_seed]];

        let mint_infos = vec![
            ctx.accounts.mint.clone(),
            ctx.accounts.token_account.clone(),
            ctx.accounts.mint_auth.clone(),
            ctx.accounts.mint_auth.clone(),
        ];
        //https://docs.rs/spl-token/3.2.0/src/spl_token/instruction.rs.html#1075-1103
        let mint_instruction = mint_to_checked(
            ctx.accounts.token_program.key,
            ctx.accounts.mint.key,
            ctx.accounts.token_account.key,
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

        //example calling another program in your program
        let mut tester_accounts = Tester {
            test: ctx.accounts.mint_auth.clone()
        };
        let tester_context = Context::new(ctx.program_id, & mut tester_accounts, &[]);
        tester(tester_context)?;
        
        //check supply -- if greater than 7, freeze
        let mint_supply = Mint::unpack(&ctx.accounts.mint.data.borrow())?.supply;
        if mint_supply > 0 {
            freeze_mint_supply(ctx, seeds)?;
        }
        Ok(())
    }

    pub fn tester(ctx: Context<Tester>) -> ProgramResult {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct MintOne<'info> {
    #[account(mut)]
    mint: AccountInfo<'info>,
    mint_auth: AccountInfo<'info>,
    #[account(mut)]
    token_account: AccountInfo<'info>,
    token_program: Program<'info, Token>,
    owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct Tester<'info> {
    test: AccountInfo<'info>
}

impl<'info>MintOne<'info> {
    fn into_freeze_mint_supply_context(&self) -> CpiContext<'_, '_, '_, 'info, SetAuthority<'info>> {
        let cpi_accounts = SetAuthority {
            current_authority: self.mint_auth.clone(),
            account_or_mint: self.mint.clone(),
        };
        let cpi_program = self.token_program.to_account_info();
        CpiContext::new(cpi_program, cpi_accounts)
    }
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
        mint: *ctx.accounts.mint.key,
        label: "this mint has been frozen".to_string(),
    });
    Ok(())
}

#[event]
pub struct FreezeMint {
    pub mint: Pubkey,
    #[index]
    pub label: String,
}