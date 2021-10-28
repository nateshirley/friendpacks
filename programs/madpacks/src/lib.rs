use anchor_lang::{prelude::*, solana_program::{program::{invoke_signed}, borsh::try_from_slice_unchecked, program_pack::Pack}};
use spl_token::{instruction::{AuthorityType}, state::Mint};
use anchor_spl::token::{self, Token, Mint as MintAccount, MintTo, TokenAccount, SetAuthority};
use spl_token_metadata::{instruction::{update_metadata_accounts}, state::Metadata};
use token_metadata_local::{create_metadata_accounts};



declare_id!("5GstP3i7wvo1NEiPDUa9TcdqFFFYaaZDATX2WyVquzT4"); ////old program id w/pda_mint 85185DcWJF1fg7qnAjGnXVf6RU9fPKxCagJ7w1rFxkps
const AUTH_PDA_SEED: &[u8] = b"authority";
const MET_PDA_SEED: &[u8] = b"metadata";

#[program]
pub mod madpacks {
    use super::*;
    pub fn create_pack(ctx: Context<CreatePack>, _auth_pda_bump: u8, meta_config: MetaConfig) -> ProgramResult {
        let (_pda, bump_seed) = Pubkey::find_program_address(&[AUTH_PDA_SEED], ctx.program_id);
        let seeds = &[&AUTH_PDA_SEED[..], &[bump_seed]];

        //make sure the pda has mint authority and freeze authority, decimal 0 before minting
        verify_incoming_mint(ctx.accounts.mint.to_account_info(), _pda)?;
        assert_metadata_matches_mint(&ctx.accounts.token_metadata_program, &ctx.accounts.mint, &ctx.accounts.metadata)?;

        let mint_supply = Mint::unpack(&ctx.accounts.mint.to_account_info().data.borrow())?.supply;
        //not checking for decimals 
        if mint_supply > 0 {
            msg!("must create with supply 0");
            return Err(ErrorCode::NonzeroSupplyCreation.into());
        }

        //do the metadata
        //https://github.com/metaplex-foundation/metaplex/blob/master/rust/token-metadata/program/src/instruction.rs#L57
        let metadata_infos = vec![
            ctx.accounts.metadata.clone(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.mint_auth.to_account_info(),  //mint authority for mint
            ctx.accounts.owner.to_account_info(),
            ctx.accounts.mint_auth.to_account_info(), //update authority for metadata
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ];
        let name = meta_config.name;
        let symbol = meta_config.symbol;
        let uri = meta_config.uri;
        let points: u16 = 0;
        let update_authority_is_signer = true;
        let is_mutable = true;
        let creators: Vec<token_metadata_local::Creator> =
        vec![token_metadata_local::Creator {
            address: ctx.accounts.mint_auth.key(),
            verified: true,
            share: 100,
        }];
        //i should probably just update it directly here to show primary sale happened. not rn
        //https://github.com/metaplex-foundation/metaplex/blob/master/rust/token-metadata/program/src/instruction.rs#L247
        let create_metadata_instruction = create_metadata_accounts(
            *ctx.accounts.token_metadata_program.key,
            *ctx.accounts.metadata.key,
            ctx.accounts.mint.key(),
            ctx.accounts.mint_auth.key(),
            ctx.accounts.owner.key(),
            ctx.accounts.mint_auth.key(),
            name,
            symbol,
            uri,
            Some(creators),
            points,
            update_authority_is_signer,
            is_mutable,
        );
        invoke_signed(
            &create_metadata_instruction,
            metadata_infos.as_slice(),
            &[&seeds[..]],
        )?;

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
        
        //check supply -- maybe freeze
        //should be > 5 that means supply var is 6 (which is before mint), so we just minted 7
        if mint_supply > 5 {
            msg!("freezing mint with supply: {}  + 1", mint_supply);
            freeze_mint_supply(ctx, seeds)?;
        }
        Ok(())
    }
    pub fn update_pack_metadata(ctx: Context<NewName>, _auth_pda_bump: u8, new_metadata: NewMetadata) -> ProgramResult {
        //what i need to know
        //signer owns the token account
        //token account matches the mint
        //mint is a pack mint
        //metadata is the metadata acct for the mint passed in

        //get the data from the existing account
        //copy it with name change
        //put it back in
        assert_metadata_matches_mint(&ctx.accounts.token_metadata_program, &ctx.accounts.mint, &ctx.accounts.metadata)?;
      
        let metadata: Metadata = try_from_slice_unchecked(&ctx.accounts.metadata.data.borrow()).unwrap();
        let mut new_data = metadata.data.clone();
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
            ctx.accounts.mint_auth.to_account_info()
        ];
        let (_pda, bump_seed) = Pubkey::find_program_address(&[AUTH_PDA_SEED], ctx.program_id);
        let seeds = &[&AUTH_PDA_SEED[..], &[bump_seed]];
        invoke_signed(
            &new_name_instruction, 
            new_name_infos.as_slice(), 
            &[&seeds[..]]
        )?;
        Ok(())
    }
}

pub fn assert_metadata_matches_mint(token_metadata_program: &AccountInfo, mint: &Account<MintAccount>, metadata: &AccountInfo) -> ProgramResult {
    let (expected_metadata, _bump) = Pubkey::find_program_address(
        &[MET_PDA_SEED, token_metadata_program.key().as_ref(), mint.key().as_ref()], 
        token_metadata_program.key
    );
    if expected_metadata != metadata.key() {
        msg!("metadata is not associated with the mint passed");
        return Err(ErrorCode::MetadataMismatch.into());
    } else {
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct MetaConfig {
    pub name: String,
    pub symbol: String,
    pub uri: String
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct NewMetadata {
    pub name: Option<String>,
    pub symbol: Option<String>,
    pub uri: Option<String>,
}

//this needs to check that there is a token in the account. it's still called NewName
#[derive(Accounts)]
#[instruction(_auth_pda_bump: u8)]
pub struct NewName<'info> {
    #[account(mut)]
    mint: Account<'info, MintAccount>,
    #[account(
        seeds = [AUTH_PDA_SEED], 
        bump = _auth_pda_bump,
    )]
    mint_auth: UncheckedAccount<'info>,
    #[account(
        has_one = owner
    )] //enforce owner of token account is the signer
    token_account: Account<'info, TokenAccount>,
    owner: Signer<'info>,
    #[account(mut)]
    metadata: AccountInfo<'info>,
    system_program: Program<'info, System>,
    #[account(address = spl_token_metadata::id())]
    token_metadata_program: AccountInfo<'info>,
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
    )] //enforce owner of token account is the signer
    token_account: Account<'info, TokenAccount>,
    owner: Signer<'info>,
    #[account(mut)]
    metadata: AccountInfo<'info>,
    system_program: Program<'info, System>,
    token_program: Program<'info, Token>,
    #[account(address = spl_token_metadata::id())]
    token_metadata_program: AccountInfo<'info>,
    rent: Sysvar<'info, Rent>,
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
    //freeze authority on the mint must be the program's auth pda
    let freeze_authority = Mint::unpack(&mint.data.borrow())?.freeze_authority.unwrap();
    if freeze_authority != pda {
        msg!("no freeze control");
        return Err(ErrorCode::NoFreezeControl.into());
    }
    //mint authority on the mint must be the program's auth pda
    let mint_authority = Mint::unpack(&mint.data.borrow())?.mint_authority.unwrap();
    if mint_authority != pda {
        msg!("no mint control");
        return Err(ErrorCode::NoMintControl.into());
    }
     //mint must have decimal 0
     let decimals = Mint::unpack(&mint.data.borrow())?.decimals;
     if decimals != 0 {
         msg!("decimals must be 0");
         return Err(ErrorCode::NonzeroDecimal.into());
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
    //not sure if i'm doing these emits right
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