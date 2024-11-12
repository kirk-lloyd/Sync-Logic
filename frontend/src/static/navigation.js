import React from 'react';

const Navigation = ({ shopOrigin }) => {
  return (
    <nav>
      <ul>
        <li><a href={`/?shop=${shopOrigin}`}>Home</a></li>
        <li><a href={`/products?shop=${shopOrigin}`}>Products</a></li>
        <li><a href={`/bundles?shop=${shopOrigin}`}>Bundles</a></li>
      </ul>
    </nav>
  );
};

export default Navigation;
