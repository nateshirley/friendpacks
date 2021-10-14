import React, { Component } from "react";
import { Link } from 'react-router-dom';
import "./global.css";
import homeLogo from "./../assets/homeLogo.png"
class Home extends Component {
  render() {
    return (
      <div className="component-parent">
        <img src={homeLogo} alt="logo" className="home-logo"/>
        <div className="home-info">A friend group primitive on Solana. Make a pack and invite your friends—then stick together.</div>
        <div className="home-button-group">
          <Link to="/find" className="home-button find">find a pack</Link>
          <Link to="/make" className="home-button make">make a pack</Link>
        </div>
      </div>
    );
  }
}

export default Home;