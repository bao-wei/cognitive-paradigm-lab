(function initializeCatalogPage() {
  "use strict";

  const platform = window.CognitionPlatform;
  const items = platform.getParadigms();
  const elements = {
    search: document.querySelector("#catalog-search"),
    category: document.querySelector("#category-filter"),
    task: document.querySelector("#task-filter"),
    clear: document.querySelector("#clear-filters"),
    count: document.querySelector("#catalog-count"),
    results: document.querySelector("#catalog-results"),
    empty: document.querySelector("#catalog-empty"),
  };

  populateSelect(elements.category, unique(items.map((item) => item.category)));
  populateSelect(elements.task, unique(items.map((item) => item.taskType)));
  render();

  [elements.search, elements.category, elements.task].forEach((control) => {
    control.addEventListener("input", render);
    control.addEventListener("change", render);
  });
  elements.clear.addEventListener("click", clearFilters);
  document.querySelector("[data-clear-filters]").addEventListener("click", clearFilters);

  function render() {
    const query = elements.search.value.trim().toLocaleLowerCase("zh-CN");
    const category = elements.category.value;
    const task = elements.task.value;
    const filtered = items.filter((item) => {
      const haystack = [item.name, item.shortDescription, item.category, item.taskType, ...item.tags, ...item.metrics]
        .join(" ").toLocaleLowerCase("zh-CN");
      return (!query || haystack.includes(query))
        && (!category || item.category === category)
        && (!task || item.taskType === task);
    });

    elements.results.replaceChildren(...filtered.map(renderCard));
    elements.results.hidden = filtered.length === 0;
    elements.empty.hidden = filtered.length !== 0;
    elements.count.textContent = `显示 ${filtered.length} / ${items.length} 个范式`;
  }

  function renderCard(item) {
    const article = document.createElement("article");
    article.className = "catalog-card";
    const metrics = item.metrics.length ? item.metrics.slice(0, 3) : ["结果见实验说明"];
    article.innerHTML = `
      <div class="catalog-card-top">
        <span class="catalog-number">${platform.escapeHtml(item.number)}</span>
        <span class="catalog-domain">${platform.escapeHtml(item.category)}</span>
      </div>
      <h3><a href="./paradigm.html?id=${encodeURIComponent(item.id)}">${platform.escapeHtml(item.name)}</a></h3>
      <p>${platform.escapeHtml(item.shortDescription)}</p>
      <ul class="metric-tags" aria-label="主要指标">
        ${metrics.map((metric) => `<li>${platform.escapeHtml(metric)}</li>`).join("")}
      </ul>
      <div class="catalog-card-footer">
        <span>${platform.escapeHtml(item.taskType)} · ${platform.escapeHtml(item.duration)}</span>
        <a href="./paradigm.html?id=${encodeURIComponent(item.id)}" aria-label="查看${platform.escapeHtml(item.name)}说明">查看说明 <span aria-hidden="true">→</span></a>
      </div>`;
    return article;
  }

  function populateSelect(select, values) {
    select.append(...values.map((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      return option;
    }));
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  }

  function clearFilters() {
    elements.search.value = "";
    elements.category.value = "";
    elements.task.value = "";
    render();
    elements.search.focus();
  }
})();
