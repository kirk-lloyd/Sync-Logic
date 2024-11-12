import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import Navigation from '../static/Navigation';
import Home from '../static/Home';
import Products from '../static/Products';

function App() {
  const shopOrigin = new URLSearchParams(window.location.search).get("shop");

  return (
    <Router>
      <Navigation shopOrigin={shopOrigin} />
      <Switch>
        <Route exact path="/" component={Home} />
        <Route path="/products" render={() => <Products shopDomain={shopOrigin} />} />
        {/* Add more routes as needed */}
      </Switch>
    </Router>
  );
}

export default App;
