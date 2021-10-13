import React, { useEffect, useState, useCallback } from "react";


const PackMembers = ({members}) => {
    let memberItems = null;
    if (members.length > 0) {
        memberItems = members.map((member, index) => {
            member = member.toBase58();
            return (<div key={index}>a member is {member}</div>);
        })
    } else {
        memberItems = <div></div>
    }

   
  
    return (
        <div>
            {memberItems}
        </div>
    );

    
}

export default PackMembers;