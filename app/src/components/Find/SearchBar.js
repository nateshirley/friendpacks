import React, { useEffect, useState, useCallback } from "react";
import "../global.css";


const SearchBar = ({handleSearchChange, searchText}) => {

  
    return (
        <input
            placeholder="search wallet or pack mint"
            onChange={e => handleSearchChange(e.target.value)}
            value={searchText}
            className="default-input search"
        />
    );

    
}

export default SearchBar;