(function (global) {
  'use strict';
  const {Textbook} = global;
  const entryId = global.TEXTBOOK_LINKED_ENTRY || '';
  const catalog = global.TEXTBOOK_LINKED_CATALOG;
  const root = document.querySelector('#stage');
  const exit = document.querySelector('#exit');
  const progress = document.querySelector('.progress-bar');
  const escape = Textbook.escape;
  const header = document.querySelector('.lab-header');
  const nav = document.createElement('nav');
  nav.className = 'linked-nav';
  nav.setAttribute('aria-label', '实验导航');
  nav.innerHTML = `${entryId ? `<a id="entry-link" href="#experiment/${entryId}">返回入口实验</a>` : ''}<a id="catalog-link" class="button quiet" href="#catalog">实验目录</a>`;
  header.insertBefore(nav, exit);
  nav.append(exit);
  let query = '', category = '';

  function resetProgress() {
    document.querySelector('#progress-text').textContent = '准备开始';
    const bar = document.querySelector('#progress');
    bar.value = 0;
    bar.max = 1;
  }

  function renderCatalog() {
    document.title = '实验目录｜妙趣认知实验室';
    const categories = [...new Set(catalog.map(task => task.category))];
    root.innerHTML = `<div class="catalog-intro"><p class="eyebrow">EXPLORE · ${catalog.length} EXPERIMENTS</p><h1>从一个实验，走进认知世界。</h1><p>选择感兴趣的范式，了解它的操作与指标，再亲手完成一次体验。</p></div>
      <form class="catalog-filters" role="search"><label for="catalog-search">搜索范式<input id="catalog-search" type="search" placeholder="名称、内容或指标" autocomplete="off" value="${escape(query)}"></label><label for="catalog-category">认知领域<select id="catalog-category"><option value="">全部领域</option>${categories.map(value => `<option value="${escape(value)}"${category === value ? ' selected' : ''}>${escape(value)}</option>`).join('')}</select></label><button id="catalog-reset" class="quiet" type="button">重置筛选</button></form>
      <p id="catalog-count" class="catalog-count" role="status" aria-live="polite"></p><div id="catalog-grid" class="catalog-grid"></div>
      <aside class="catalog-notice"><h2>使用须知</h2><p>这些短实验仅用于教学体验，不能用于科研数据采集或个人能力评估。数据只保留在当前页面；返回目录、切换实验或关闭页面都会清除本次结果，请先导出需要的数据。音视频实验请打开声音，并按画面提示点击播放。</p></aside>`;
    const search = root.querySelector('#catalog-search');
    const select = root.querySelector('#catalog-category');
    root.querySelector('form').onsubmit = event => event.preventDefault();
    search.oninput = () => { query = search.value; updateCards(); };
    select.onchange = () => { category = select.value; updateCards(); };
    root.querySelector('#catalog-reset').onclick = () => {
      query = category = '';
      search.value = select.value = '';
      updateCards();
      search.focus();
    };
    updateCards();
  }

  function updateCards() {
    const needle = query.trim().toLocaleLowerCase();
    const matches = catalog.filter(task => (!category || task.category === category) && (!needle || [task.name, task.shortDescription, task.category, ...task.metrics].join(' ').toLocaleLowerCase().includes(needle)));
    root.querySelector('#catalog-count').textContent = `显示 ${matches.length} / ${catalog.length} 个实验范式`;
    root.querySelector('#catalog-grid').innerHTML = matches.length ? matches.map(task => `<article class="catalog-card"><p class="catalog-category">${escape(task.category)}</p><h2><a href="#experiment/${task.id}">${escape(task.name)}</a></h2><p class="catalog-description">${escape(task.shortDescription)}</p><p class="catalog-metrics">观察指标：${task.metrics.map(escape).join(' · ')}</p><div class="catalog-card-bottom"><span>${escape(typeof task.trialCount === 'number' ? task.trialCount + ' 个正式试次' : task.trialCount)}</span><a class="catalog-open" href="#experiment/${task.id}" aria-label="进入${escape(task.name)}">进入实验 <span aria-hidden="true">↗</span></a></div></article>`).join('') : '<div class="catalog-empty"><h2>没有找到匹配的范式</h2><p>试试其他关键词，或重置筛选查看全部实验。</p></div>';
  }

  function route() {
    // Use the runtime's own exit handler so pending trials, media and export URLs are cleaned up.
    if (typeof exit.onclick === 'function') exit.onclick();
    resetProgress();
    document.querySelector('#visibility-note').hidden = true;
    const hash = location.hash;
    const id = !hash ? entryId : /^#experiment\/([a-z0-9-]+)$/.exec(hash)?.[1];
    const isCatalog = hash === '#catalog' || (!hash && !entryId);
    const validTask = id && Textbook.tasks.has(id);
    progress.hidden = !validTask;
    exit.hidden = !validTask;
    const entryLink = document.querySelector('#entry-link');
    if (entryLink) entryLink.hidden = id === entryId;
    const catalogLink = document.querySelector('#catalog-link');
    if (isCatalog) catalogLink.setAttribute('aria-current', 'page');
    else catalogLink.removeAttribute('aria-current');
    root.setAttribute('aria-label', isCatalog ? '实验目录' : '实验任务');
    if (isCatalog) renderCatalog();
    else if (validTask) {
      global.TEXTBOOK_OFFLINE_ID = id;
      Textbook.launch();
    } else {
      document.title = '没有找到实验｜妙趣认知实验室';
      root.innerHTML = '<h1>没有找到这个实验</h1><p>请返回目录选择一个实验。</p><a class="button" href="#catalog">实验目录</a>';
    }
    root.focus({preventScroll: true});
    global.scrollTo(0, 0);
  }

  new MutationObserver(() => {
    if (root.querySelector('#begin')) resetProgress();
    const actions = root.querySelector('.result-actions');
    if (actions && !actions.querySelector('.linked-result-catalog')) {
      const link = document.createElement('a');
      link.href = '#catalog';
      link.className = 'button quiet linked-result-catalog';
      link.textContent = '实验目录';
      actions.append(link);
      const note = document.createElement('span');
      note.className = 'result-note linked-export-note';
      note.textContent = '返回目录会清除本次结果，需要保留时请先导出 CSV。';
      actions.append(note);
    }
  }).observe(root, {childList: true});

  global.addEventListener('hashchange', route);
  route();
})(window);
