const { chromium } = (function(){ try { return require('playwright'); } catch(e){ return require('playwright-core'); } })();
const path = require('path');
(async()=>{
  const b=await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  const p=await b.newPage();
  await p.setContent(`<html><body style="font-family:Helvetica,Arial,sans-serif;padding:40px;font-size:13px">
  <h1>Portfolio Risk Analysis</h1><p>Prepared for David &amp; Ellen Renner · Current Portfolio</p>
  <h2>Your Risk Number <span style="font-size:40px">48</span></h2><h2>Portfolio Risk Number <span style="font-size:40px">72</span></h2>
  <p>95% Historical Range (6 months): <b>−14.2%</b> to <b>+21.8%</b> &nbsp; ($−85,200 to $130,800)</p>
  <p>Portfolio Value: $600,000 &nbsp; GPA 3.4 &nbsp; Annual Dividend 1.9% &nbsp; Expense Ratio 0.42%</p>
  <h3>Allocation</h3><table><tr><td>Stocks</td><td>74.0%</td></tr><tr><td>Bonds</td><td>18.5%</td></tr><tr><td>Cash</td><td>4.5%</td></tr><tr><td>Alternatives</td><td>3.0%</td></tr></table>
  <h3>Holdings</h3><table><tr><td>VTI</td><td>Vanguard Total Stock Market ETF</td><td>$210,000</td><td>35.0%</td><td>Risk 75</td></tr>
  <tr><td>QQQ</td><td>Invesco QQQ Trust</td><td>$120,000</td><td>20.0%</td><td>Risk 86</td></tr>
  <tr><td>BND</td><td>Vanguard Total Bond Market ETF</td><td>$90,000</td><td>15.0%</td><td>Risk 22</td></tr>
  <tr><td>AAPL</td><td>Apple Inc.</td><td>$72,000</td><td>12.0%</td><td>Risk 84</td></tr>
  <tr><td>MSFT</td><td>Microsoft Corp.</td><td>$60,000</td><td>10.0%</td><td>Risk 80</td></tr>
  <tr><td>SCHD</td><td>Schwab U.S. Dividend Equity ETF</td><td>$48,000</td><td>8.0%</td><td>Risk 63</td></tr></table>
  <h3>Stress Tests</h3><table>
  <tr><th>Scenario</th><th>Portfolio</th><th>Dollars</th><th>S&amp;P 500</th></tr>
  <tr><td>2008 Bear Market</td><td>−38.6%</td><td>$−231,600</td><td>−50.9%</td></tr>
  <tr><td>2013 Bull Market</td><td>+24.1%</td><td>$144,600</td><td>+32.4%</td></tr>
  <tr><td>Financial Crisis (Oct 2007 – Mar 2009)</td><td>−41.2%</td><td>$−247,200</td><td>−55.2%</td></tr>
  <tr><td>Interest Rate Spike</td><td>−6.8%</td><td>$−40,800</td><td>−12.0%</td></tr>
  <tr><td>Return to Normal Rates</td><td>−3.1%</td><td>$−18,600</td><td>−4.2%</td></tr></table>
  </body></html>`);
  await p.pdf({path:'nitro-sample.pdf', format:'Letter'});
  await b.close(); console.log('pdf written');
})();
