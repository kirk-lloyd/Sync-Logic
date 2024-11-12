import React from 'react';

const Home = () => (
  <div>
    <h1>Home</h1>
    <p>Welcome to the Stock Sync Logic Dashboard home page. Here you can manage your store's products, bundles, and sync status.</p>
    <div className="summary">
      <div className="summary-item"><h3>Last Sync Time</h3><p>Not Available</p></div>
      <div className="summary-item"><h3>Sync Status</h3><p>Not Available</p></div>
      <div className="summary-item"><h3>Total Synced Products</h3><p>0</p></div>
      <div className="summary-item"><h3>Total Bundles</h3><p>0</p></div>
      <div className="summary-item"><h3>Next Scheduled Sync</h3><p>Not Scheduled</p></div>
    </div>
    <button className="sync-button" onClick={() => alert('Manual sync triggered!')}>Manual Sync</button>
  </div>
);

export default Home;
