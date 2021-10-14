import React, { useEffect, useState, useCallback } from "react";


const SearchBar = ({handleSearchChange, searchText}) => {

  
    return (
        <input
            placeholder="search wallet or pack mint"
            onChange={e => handleSearchChange(e.target.value)}
            value={searchText}
        />
    );

    
}

export default SearchBar;