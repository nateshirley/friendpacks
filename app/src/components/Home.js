import React, { Component } from "react";
import { Link } from 'react-router-dom';

class Home extends Component {
  render() {
    return (
      <div>
        <h2>Home</h2>
        <p>This the home page b</p>
        <li><Link to="/find">find a pack</Link></li>
        <li><Link to="/create">start a pack</Link></li>
      </div>
    );
  }
}
 
export default Home;