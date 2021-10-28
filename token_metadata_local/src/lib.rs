use {
    anchor_lang::{
        prelude::*,
        solana_program::{self, program_option::COption},
    },
    borsh::{BorshDeserialize, BorshSerialize},
    solana_program::{
        instruction::{AccountMeta, Instruction},
        pubkey::Pubkey,
        sysvar,
    },
    spl_token,
    spl_token_metadata::{
        instruction::{
            update_metadata_accounts, CreateMasterEditionArgs, CreateMetadataAccountArgs,
            MetadataInstruction,
        },
        state::{Creator, Data, Metadata},
    },
};

//had to write custom impl because the crate is wrong
#[allow(clippy::too_many_arguments)]
pub fn create_metadata_accounts(
    program_id: Pubkey,
    metadata_account: Pubkey,
    mint: Pubkey,
    mint_authority: Pubkey,
    payer: Pubkey,
    update_authority: Pubkey,
    name: String,
    symbol: String,
    uri: String,
    creators: Option<Vec<Creator>>,
    seller_fee_basis_points: u16,
    update_authority_is_signer: bool,
    is_mutable: bool,
) -> Instruction {
    Instruction {
        program_id,
        accounts: vec![
            AccountMeta::new(metadata_account, false),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new_readonly(mint_authority, true),
            AccountMeta::new(payer, true),
            AccountMeta::new_readonly(update_authority, update_authority_is_signer),
            AccountMeta::new_readonly(solana_program::system_program::id(), false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
        ],
        data: MetadataInstruction::CreateMetadataAccount(CreateMetadataAccountArgs {
            data: Data {
                name,
                symbol,
                uri,
                seller_fee_basis_points,
                creators,
            },
            is_mutable,
        })
        .try_to_vec()
        .unwrap(),
    }
}

pub fn create_metadata<'a, 'b, 'c, 'info>(
    ctx: CpiContext<'a, 'b, 'c, 'info, CreateMetadata<'info>>,
    name: String,
    symbol: String,
    uri: String,
    creators: Option<Vec<Creator>>,
    seller_fee_basis_points: u16,
    update_authority_is_signer: bool,
    is_mutable: bool,
) -> ProgramResult {
    let ix = create_metadata_accounts(
        *ctx.accounts.token_metadata_program.key,
        *ctx.accounts.metadata.key,
        ctx.accounts.mint.key(),
        ctx.accounts.mint_authority.key(),
        ctx.accounts.payer.key(),
        ctx.accounts.update_authority.key(),
        name,
        symbol,
        uri,
        creators,
        seller_fee_basis_points,
        update_authority_is_signer,
        is_mutable,
    );
    solana_program::program::invoke_signed(
        &ix,
        &[
            ctx.accounts.metadata.clone(),
            ctx.accounts.mint.to_account_info(),
            ctx.accounts.mint_authority.to_account_info(),
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.update_authority.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ],
        ctx.signer_seeds,
    )?;
    Ok(())
}

//don't need to use anchor macros here because the token metadata program does the checks
#[derive(Accounts)]
pub struct CreateMetadata<'info> {
    pub metadata: AccountInfo<'info>, //Metadata key (pda of ['metadata', program id, mint id])
    pub mint: AccountInfo<'info>,     //mint of the token we are creating metadata for
    pub mint_authority: AccountInfo<'info>,
    pub payer: Signer<'info>,
    pub update_authority: AccountInfo<'info>, //this is the account that will have future ability to update the newly created metadata
    #[account(address = spl_token_metadata::id())]
    pub token_metadata_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
/*
/// creates a create_master_edition instruction
/// //not using this
#[allow(clippy::too_many_arguments)]
pub fn create_master_edition(
    program_id: Pubkey,
    edition: Pubkey,
    mint: Pubkey,
    update_authority: Pubkey,
    mint_authority: Pubkey,
    metadata: Pubkey,
    payer: Pubkey,
    max_supply: Option<u64>,
) -> Instruction {
    let accounts = vec![
        AccountMeta::new(edition, false),
        AccountMeta::new(mint, false),
        AccountMeta::new_readonly(update_authority, true),
        AccountMeta::new_readonly(mint_authority, true),
        AccountMeta::new(payer, true),
        AccountMeta::new_readonly(metadata, false),
        AccountMeta::new_readonly(spl_token::id(), false),
        AccountMeta::new_readonly(solana_program::system_program::id(), false),
        AccountMeta::new_readonly(sysvar::rent::id(), false),
    ];

    Instruction {
        program_id,
        accounts,
        data: MetadataInstruction::CreateMasterEdition(CreateMasterEditionArgs { max_supply })
            .try_to_vec()
            .unwrap(),
    }
}
*/
