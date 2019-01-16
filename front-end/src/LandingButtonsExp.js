import React, { Component } from "react";
import { Link } from 'react-router-dom';
import './LandingButtonsExp.css';

const LandingButtonsExp = () => {
  return (
    <div>
      <nav>
        <ul>
          <div className='moving'>
          <li class="">
            <Link to='/'>
              Home
            </Link>
          </li>
          <li class="">
            <Link to='/designs'>
             Designs
            </Link>
          </li>
          <li class="">
            <Link to='/pricing'>
             Pricing
            </Link>
          </li>
          </div>
        </ul>
      </nav>
    </div>
  );
};

export default LandingButtonsExp;