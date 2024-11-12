import React, { useState, useEffect } from 'react';

const Products = ({ shopDomain }) => {
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Fetch products via GraphQL
    const fetchProducts = async () => {
      const query = `{ products(first: 50) { edges { node { id title vendor productType variants(first: 1) { edges { node { sku inventoryQuantity } } } } } } }`;
      const response = await fetch(`/api/products/graphql?shop=${encodeURIComponent(shopDomain)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shop-Domain': shopDomain,
        },
        body: JSON.stringify({ query }),
      });
      const data = await response.json();
      const fetchedProducts = data.data.products.edges.map(edge => {
        const product = edge.node;
        const variant = product.variants.edges[0]?.node || {};
        return {
          id: product.id,
          title: product.title,
          vendor: product.vendor,
          product_type: product.productType,
          sku: variant.sku || '-',
          inventory_quantity: variant.inventoryQuantity || 0,
        };
      });
      setProducts(fetchedProducts);
    };

    fetchProducts();
  }, [shopDomain]);

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
  };

  const filteredProducts = products.filter(product => product.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div>
      <h1>Products</h1>
      <p>Manage your store's products. Choose a product to be the "Sync Master" and link products it will control for stock synchronization.</p>
      <input type="text" placeholder="Search products..." onChange={handleSearch} />
      <table>
        <thead>
          <tr>
            <th>Product Name</th>
            <th>SKU</th>
            <th>Inventory</th>
            <th>Product Type</th>
            <th>Vendor</th>
            <th>Stock Master</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredProducts.map(product => (
            <tr key={product.id}>
              <td>{product.title}</td>
              <td>{product.sku}</td>
              <td>{product.inventory_quantity}</td>
              <td>{product.product_type}</td>
              <td>{product.vendor}</td>
              <td>
                <input
                  type="checkbox"
                  onChange={() => console.log(`Updating stock master status for ${product.id}`)}
                />
              </td>
              <td>
                <button onClick={() => console.log(`Linking products for ${product.id}`)}>Link Products</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Products;
