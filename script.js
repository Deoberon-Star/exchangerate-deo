/* =========================================================================
   RealTime Exchange - Single JS for all pages (index, converter, dashboard)
   Using Exchangerate-API with provided API key
   ========================================================================= */

(function () {
  const $id = (id) => document.getElementById(id);
  const qs = (sel, parent=document) => parent.querySelector(sel);
  const fmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

  // ---------- Drawer ----------
  (function initDrawer(){
    const menuToggle = $id('menuToggle');
    const navigationDrawer = $id('navigationDrawer');
    const closeDrawer = $id('closeDrawer');
    const drawerOverlay = $id('drawerOverlay');
    if (!menuToggle || !navigationDrawer) return;

    const open = () => navigationDrawer.classList.remove('-translate-x-full');
    const close = () => navigationDrawer.classList.add('-translate-x-full');
    menuToggle.addEventListener('click', open);
    closeDrawer && closeDrawer.addEventListener('click', close);
    drawerOverlay && drawerOverlay.addEventListener('click', close);
  })();

  // ---------- Index Redirect ----------
  (function initIndexRedirect() {
    const loading = qs('.loading-container');
    if (!loading) return;
    setTimeout(() => {
      window.location.href = 'currency_exchange_dashboard.html';
    }, 1200);
  })();

  // ---------- Rates Service ----------
  const RatesService = (function(){
    let cache = null;
    let lastUpdated = null;
    const fallback = {
      USD: 1, EUR: 0.92, SGD: 1.35, MYR: 4.25,
      JPY: 160.0, GBP: 0.78, IDR: 15500
    };

    async function fetchRates() {
      if (cache) return { rates: cache, lastUpdated };
      try {
        const res = await fetch('https://v6.exchangerate-api.com/v6/ea8c8d6bd527b492b8035e0b/latest/USD');
        const data = await res.json();
        if (!data || !data.conversion_rates) throw new Error('no rates');
        cache = data.conversion_rates;
        lastUpdated = new Date();
      } catch (e) {
        cache = fallback;
        lastUpdated = new Date();
        console.warn('Using fallback rates:', e?.message || e);
      }
      return { rates: cache, lastUpdated };
    }

    function convert(amount, from, to, rates) {
      if (!rates[from] || !rates[to]) return NaN;
      if (from === 'USD') return amount * rates[to];
      if (to === 'USD') return amount / rates[from];
      return amount * (rates[to] / rates[from]);
    }

    return { fetchRates, convert };
  })();

  // ---------- Converter Page ----------
  (async function initConverter(){
    const fromCurrency = $id('fromCurrency');
    const toCurrency   = $id('toCurrency');
    const fromAmount   = $id('fromAmount');
    const toAmount     = $id('toAmount');
    const fromFlag     = $id('fromFlag');
    const toFlag       = $id('toFlag');
    const rateDisplay  = $id('rateDisplay');
    const swapButton   = $id('swapButton');
    if (!fromCurrency || !toCurrency || !fromAmount || !toAmount) return;

    const { rates } = await RatesService.fetchRates();

    function updateFlags() {
      try {
        const fromOption = fromCurrency.options[fromCurrency.selectedIndex];
        const toOption   = toCurrency.options[toCurrency.selectedIndex];
        if (fromFlag && fromOption?.dataset?.flag) fromFlag.src = fromOption.dataset.flag;
        if (toFlag   && toOption?.dataset?.flag)   toFlag.src   = toOption.dataset.flag;
      } catch {}
    }

    function updateConversion() {
      const amount = parseFloat(fromAmount.value) || 0;
      const value = RatesService.convert(amount, fromCurrency.value, toCurrency.value, rates);
      if (!isNaN(value)) toAmount.value = fmt.format(value);
      if (rateDisplay) {
        const unit = RatesService.convert(1, fromCurrency.value, toCurrency.value, rates);
        rateDisplay.textContent = `1 ${fromCurrency.value} = ${fmt.format(unit)} ${toCurrency.value}`;
      }
    }

    function swap() {
      const f = fromCurrency.value;
      fromCurrency.value = toCurrency.value;
      toCurrency.value = f;
      updateFlags();
      updateConversion();
    }

    fromCurrency.addEventListener('change', () => { updateFlags(); updateConversion(); });
    toCurrency.addEventListener('change', () => { updateFlags(); updateConversion(); });
    fromAmount.addEventListener('input', updateConversion);
    swapButton && swapButton.addEventListener('click', swap);

    updateFlags();
    updateConversion();
  })();

  // ---------- Dashboard Page ----------
  (async function initDashboard(){
    const grid        = $id('currencyGrid');
    const statusText  = $id('statusText');
    const lastUpdate  = $id('lastUpdate');
    const refreshBtn  = $id('refreshBtn');
    const rateInfo    = $id('rateInfo');
    const fromCur     = $id('fromCurrency');
    const toCur       = $id('toCurrency');
    const fromAmt     = $id('fromAmount');
    const toAmt       = $id('toAmount');

    if (!grid && !statusText && !fromCur) return;

    async function load() {
      statusText && (statusText.textContent = 'Memuat data...');
      const { rates, lastUpdated } = await RatesService.fetchRates();
      statusText && (statusText.textContent = 'Data siap');
      lastUpdate && (lastUpdate.textContent =
        new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(lastUpdated));

      const list = ['USD','EUR','SGD','MYR','JPY','GBP'];
      if (grid) {
        grid.innerHTML = list.map(code => {
          const toIDR = RatesService.convert(1, code, 'IDR', rates);
          return `
            <div class="rounded-xl border border-secondary-200 bg-white p-4 shadow-sm">
              <div class="flex items-center justify-between">
                <div class="text-sm text-secondary-600">${code} → IDR</div>
                <div class="text-xs px-2 py-1 rounded-full bg-primary-50 text-primary-600">realtime</div>
              </div>
              <div class="mt-2 text-2xl font-semibold text-text-primary">Rp ${fmt.format(toIDR)}</div>
            </div>
          `;
        }).join('');
      }

      function updateConversion() {
        if (!(fromCur && toCur && fromAmt && toAmt)) return;
        const amount = parseFloat(fromAmt.value) || 0;
        const result = RatesService.convert(amount, fromCur.value, toCur.value, rates);
        toAmt.value = isNaN(result) ? '' : fmt.format(result);
        rateInfo && (rateInfo.textContent = `1 ${fromCur.value} = ${fmt.format(RatesService.convert(1, fromCur.value, toCur.value, rates))} ${toCur.value}`);
      }

      if (fromCur && !fromCur._bound) {
        fromCur.addEventListener('change', updateConversion);
        toCur && toCur.addEventListener('change', updateConversion);
        fromAmt && fromAmt.addEventListener('input', updateConversion);
        refreshBtn && refreshBtn.addEventListener('click', () => location.reload());
        fromCur._bound = true;
      }

      updateConversion();
    }

    load();
  })();

})();
