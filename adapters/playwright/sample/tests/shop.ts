import { Page } from '@playwright/test';

// A tiny in-memory shop so the sample needs no web server.
export async function open_shop(page: Page) {
  await page.setContent(`
    <h1>Sample shop</h1>
    <input id="search" placeholder="Search products">
    <ul id="results"></ul>
    <button id="add">Add to cart</button>
    <span id="cart">0</span>
    <script>
      const products = ['Robot', 'Playwright', 'Dashboard', 'Keyboard'];
      document.getElementById('search').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        document.getElementById('results').innerHTML = products
          .filter((p) => p.toLowerCase().includes(q))
          .map((p) => '<li>' + p + '</li>').join('');
      });
      document.getElementById('add').addEventListener('click', () => {
        const cart = document.getElementById('cart');
        cart.textContent = String(Number(cart.textContent) + 1);
      });
    </script>
  `);
}

// Fails roughly `rate` of the time, so repeated sample runs produce varied trends.
export function unlucky(rate: number) {
  return Math.random() < rate;
}

// A page object, as many projects use them. Its methods show up as keywords with the
// dashboard reporter's groupByFunction option, without any test.step().
export class ShopPage {
  constructor(private readonly page: Page) {}

  async open() {
    await open_shop(this.page);
  }

  async search(term: string) {
    await this.page.fill('#search', term);
  }

  async addToCart(count: number) {
    for (let i = 0; i < count; i++) {
      await this.page.click('#add');
    }
  }
}
