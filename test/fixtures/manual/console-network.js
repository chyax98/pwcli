async (page) => {
  await page.setContent(`
    <button id="fire">fire</button>
    <div id="status">idle</div>
    <script>
      document.getElementById('fire').addEventListener('click', () => {
        console.log('manual-log');
        console.warn('manual-warn');
        console.error('manual-error');
        const img = new Image();
        img.src = 'https://example.com/missing-api?pwcli=1';
        img.addEventListener('error', () => console.error('image-failed'));
        document.body.appendChild(img);
        document.getElementById('status').textContent = 'done';
      });
    </script>
  `);
  return "ready";
};
