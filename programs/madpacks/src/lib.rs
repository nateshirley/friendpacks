use anchor_lang::{
    prelude::*,
    solana_program::{borsh::try_from_slice_unchecked, program::invoke_signed},
};
use anchor_spl::token;
use spl_token::instruction::AuthorityType;
use spl_token_metadata::{
    instruction::update_metadata_accounts,
    state::{Creator, Metadata},
};
use token_metadata_local;

/*

- move verify incoming mint -- good
- move assert metadata matches mint --good

*/
//5GstP3i7wvo1NEiPDUa9TcdqFFFYaaZDATX2WyVquzT4 --- aciddent today: 21qFE7jDmgDrndEMUTi1JZhiKcGq8JXfimwq9MbAMcrx
declare_id!("5GstP3i7wvo1NEiPDUa9TcdqFFFYaaZDATX2WyVquzT4"); ////old program id w/pda_mint 85185DcWJF1fg7qnAjGnXVf6RU9fPKxCagJ7w1rFxkps
const AUTH_PDA_SEED: &[u8] = b"authority";

#[program]
pub mod madpacks {
    use super::*;
    pub fn create_pack(
        ctx: Context<CreatePack>,
        _auth_pda_bump: u8,
        meta_config: MetaConfig,
    ) -> ProgramResult {
        let (_pda, bump_seed) = Pubkey::find_program_address(&[AUTH_PDA_SEED], ctx.program_id);
        let seeds = &[&AUTH_PDA_SEED[..], &[bump_seed]];

        token_metadata_local::create_metadata(
            ctx.accounts
                .into_create_pack_metadata_context()
                .with_signer(&[&seeds[..]]),
            meta_config.name,
            meta_config.symbol,
            meta_config.uri,
            Some(vec![Creator {
                address: ctx.accounts.mint_auth.key(),
                verified: true,
                share: 100,
            }]),
            0,
            true,
            true,
        )?;

        //mint to the user's token account
        let cpi_accounts = token::MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.mint_auth.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::mint_to(
            CpiContext::new_with_signer(cpi_program, cpi_accounts, &[&seeds[..]]),
            1,
        )?;

        Ok(())
    }
    pub fn join_pack(ctx: Context<JoinPack>, _auth_pda_bump: u8) -> ProgramResult {
        //charge a small fee? -- idk maybe not on this one. enough to discourage u from doing it for no reason. idk
        //make sure the supply is > 0 before minting. you have to call create_pack before joining
        let (_pda, bump_seed) = Pubkey::find_program_address(&[AUTH_PDA_SEED], ctx.program_id);
        let seeds = &[&AUTH_PDA_SEED[..], &[bump_seed]];
        //mint to the user's token account
        let cpi_accounts = token::MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.mint_auth.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        token::mint_to(
            CpiContext::new_with_signer(cpi_program, cpi_accounts, &[&seeds[..]]),
            1,
        )?;

        //check supply -- maybe freeze
        //should be > 5 that means supply var is 6 (which is before mint), so we just minted 7
        let mint_supply = ctx.accounts.mint.supply;
        if mint_supply > 5 {
            msg!("freezing mint with supply: {}  + 1", mint_supply);
            freeze_mint_supply(ctx, seeds)?;
        }
        Ok(())
    }
    pub fn update_pack_metadata(
        ctx: Context<UpdatePackMetadata>,
        _auth_pda_bump: u8,
        new_metadata: NewMetadata,
    ) -> ProgramResult {
        let metadata: Metadata =
            try_from_slice_unchecked(&ctx.accounts.metadata.data.borrow()).unwrap();
        let mut new_data = metadata.data;
        if let Some(name) = new_metadata.name {
            new_data.name = name;
        }
        if let Some(symbol) = new_metadata.symbol {
            new_data.symbol = symbol;
        }
        if let Some(uri) = new_metadata.uri {
            new_data.uri = uri;
        }

        let new_name_instruction = update_metadata_accounts(
            ctx.accounts.token_metadata_program.key(),
            ctx.accounts.metadata.key(),
            ctx.accounts.mint_auth.key(),
            None,
            Some(new_data),
            None,
        );
        let new_name_infos = vec![
            ctx.accounts.metadata.clone(),
            ctx.accounts.mint_auth.to_account_info(),
        ];
        let (_pda, bump_seed) = Pubkey::find_program_address(&[AUTH_PDA_SEED], ctx.program_id);
        let seeds = &[&AUTH_PDA_SEED[..], &[bump_seed]];
        invoke_signed(
            &new_name_instruction,
            new_name_infos.as_slice(),
            &[&seeds[..]],
        )?;
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct MetaConfig {
    pub name: String,
    pub symbol: String,
    pub uri: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct NewMetadata {
    pub name: Option<String>,
    pub symbol: Option<String>,
    pub uri: Option<String>,
}

#[derive(Accounts)]
#[instruction(_auth_pda_bump: u8)]
pub struct UpdatePackMetadata<'info> {
    #[account(mut)]
    mint: Account<'info, token::Mint>,
    #[account(
        seeds = [AUTH_PDA_SEED],
        bump = _auth_pda_bump,
    )]
    mint_auth: UncheckedAccount<'info>,
    #[account(
        constraint = token_account.owner == owner.key(),
        constraint = token_account.amount > 0,
    )]
    token_account: Account<'info, token::TokenAccount>,
    owner: Signer<'info>,
    #[account(mut)] //address validated to match mint by the metadata program
    metadata: AccountInfo<'info>,
    system_program: Program<'info, System>,
    #[account(address = spl_token_metadata::id())]
    token_metadata_program: AccountInfo<'info>,
}

#[derive(Accounts)]
#[instruction(_auth_pda_bump: u8)]
pub struct CreatePack<'info> {
    #[account(
        mut,
        constraint = mint.supply == 0,
        constraint = mint.decimals == 0,
        constraint = mint.freeze_authority.unwrap() == mint_auth.key(),
        constraint = mint.mint_authority.unwrap() == mint_auth.key()
    )]
    mint: Account<'info, token::Mint>,
    #[account(
        seeds = [AUTH_PDA_SEED],
        bump = _auth_pda_bump,
    )]
    mint_auth: UncheckedAccount<'info>,
    #[account(
        mut,
        has_one = owner
    )] //enforce owner of token account is the signer
    token_account: Account<'info, token::TokenAccount>,
    owner: Signer<'info>,
    #[account(mut)]
    metadata: AccountInfo<'info>,
    system_program: Program<'info, System>,
    token_program: Program<'info, token::Token>,
    #[account(address = spl_token_metadata::id())]
    token_metadata_program: AccountInfo<'info>,
    rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(_auth_pda_bump: u8)]
pub struct JoinPack<'info> {
    #[account(
        mut,
        constraint = mint.supply > 0,
        constraint = mint.decimals == 0,
        constraint = mint.freeze_authority.unwrap() == mint_auth.key(),
        constraint = mint.mint_authority.unwrap() == mint_auth.key()
    )]
    mint: Account<'info, token::Mint>,
    #[account(
        seeds = [AUTH_PDA_SEED],
        bump = _auth_pda_bump,
    )]
    mint_auth: UncheckedAccount<'info>,
    #[account(
        mut,
        has_one = owner
    )]
    token_account: Account<'info, token::TokenAccount>,
    owner: Signer<'info>,
    token_program: Program<'info, token::Token>,
}

impl<'info> CreatePack<'info> {
    fn into_create_pack_metadata_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token_metadata_local::CreateMetadata<'info>> {
        let cpi_program = self.token_metadata_program.to_account_info();
        let cpi_accounts = token_metadata_local::CreateMetadata {
            metadata: self.metadata.to_account_info(),
            mint: self.mint.to_account_info(),
            mint_authority: self.mint_auth.to_account_info(),
            payer: self.owner.clone(),
            update_authority: self.mint_auth.to_account_info(),
            token_metadata_program: self.token_metadata_program.to_account_info(),
            system_program: self.system_program.clone(),
            rent: self.rent.clone(),
        };
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

fn freeze_mint_supply(ctx: Context<JoinPack>, seeds: &[&[u8]; 2]) -> ProgramResult {
    token::set_authority(
        ctx.accounts
            .into_freeze_mint_supply_context()
            .with_signer(&[&seeds[..]]),
        AuthorityType::MintTokens,
        None,
    )?;
    //not sure if i'm doing these emits right
    emit!(FreezeMint {
        mint: *ctx.accounts.mint.to_account_info().key,
        label: "this mint has been frozen".to_string(),
    });
    Ok(())
}
impl<'info> JoinPack<'info> {
    fn into_freeze_mint_supply_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, token::SetAuthority<'info>> {
        let cpi_accounts = token::SetAuthority {
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
    #[msg("pack mints must have decimal zero")]
    NonzeroDecimal,
    #[msg("new packs must have zero supply")]
    NonzeroSupplyCreation,
    #[msg("metadata not attached to the mint passed")]
    MetadataMismatch,
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
