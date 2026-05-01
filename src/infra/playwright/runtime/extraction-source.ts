import type { NormalizedExtractRecipe } from './extraction-types.js';

export function buildExtractionSource(recipe: NormalizedExtractRecipe) {
  return `async page => {
    const recipe = ${JSON.stringify(recipe)};
    const collectIframeContexts = async () => {
      return await page.evaluate(() => {
        const normalizeText = value => String(value ?? '').replace(/\\s+/g, ' ').trim();
        const readDirectHeadingText = element => {
          const heading = element.querySelector(
            ':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6'
          );
          return heading instanceof HTMLElement
            ? normalizeText(heading.innerText || heading.textContent || '')
            : '';
        };
        const toSectionPath = (node, boundaryRoot) => {
          const path = [];
          let current = node.parentElement;
          while (current && current !== boundaryRoot && path.length < 4) {
            const headingText = readDirectHeadingText(current);
            if (headingText && path[0] !== headingText)
              path.unshift(headingText);
            current = current.parentElement;
          }
          return path;
        };
        return Array.from(document.querySelectorAll('iframe, frame')).map(node => ({
          url:
            typeof node.src === 'string' && node.src.trim().length > 0
              ? node.src
              : typeof node.getAttribute === 'function'
                ? normalizeText(node.getAttribute('src') ?? '')
                : '',
          sectionPath: toSectionPath(node, document.body || document.documentElement),
        }));
      });
    };

    const collectSameOriginFrameDocument = async (frame, inheritedSectionPath) => {
      return await frame.evaluate((inheritedSectionPath) => {
        const normalizeText = value => String(value ?? '').replace(/\\s+/g, ' ').trim();
        const isElementNode = node =>
          Boolean(node) && typeof node === 'object' && node.nodeType === Node.ELEMENT_NODE;
        const isHtmlLikeElement = node =>
          isElementNode(node)
          && typeof node.getBoundingClientRect === 'function'
          && typeof node.getClientRects === 'function';
        const isVisible = node => {
          if (!isHtmlLikeElement(node))
            return false;
          const ownerView = node.ownerDocument?.defaultView || window;
          const style = ownerView.getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')
            return false;
          return true;
        };
        const readDirectHeadingText = element => {
          const heading = Array.from(element.children).find((child) => /^H[1-6]$/.test(child.tagName));
          if (!isElementNode(heading))
            return '';
          return normalizeText(heading.innerText || heading.textContent || '');
        };
        const mergeSectionPath = (prefix, suffix) => {
          const merged = [...prefix, ...suffix]
            .filter(item => typeof item === 'string' && item.trim().length > 0)
            .map(item => item.trim());
          const deduped = [];
          for (const item of merged) {
            if (deduped[deduped.length - 1] !== item)
              deduped.push(item);
          }
          return deduped.slice(0, 4);
        };
        const toSectionPath = (node, boundaryRoot) => {
          const path = [];
          let current = node.parentElement;
          while (current && current !== boundaryRoot && path.length < 4) {
            const headingText = readDirectHeadingText(current);
            if (headingText && path[0] !== headingText)
              path.unshift(headingText);
            current = current.parentElement;
          }
          return path;
        };
        const collectVideoUrl = element => {
          if (!isElementNode(element) || element.tagName?.toLowerCase() !== 'video')
            return '';
          if (typeof element.currentSrc === 'string' && element.currentSrc.trim())
            return normalizeText(element.currentSrc);
          if (typeof element.src === 'string' && element.src.trim())
            return normalizeText(element.src);
          const source = element.querySelector('source[src]');
          if (source && typeof source.src === 'string')
            return normalizeText(source.src);
          return '';
        };
        const readCodeText = element =>
          String(
            isHtmlLikeElement(element)
              ? element.innerText || element.textContent || ''
              : element.textContent || ''
          ).trim();
        const readCodeLanguage = element => {
          const languageSource =
            element.tagName.toLowerCase() === 'pre'
              ? element.querySelector('code')
              : element;
          const className =
            typeof languageSource?.getAttribute === 'function'
              ? (languageSource.getAttribute('class') ?? '')
              : '';
          const classTokens = className.split(/\\s+/).filter(Boolean);
          const token = classTokens.find(item => item.startsWith('language-'));
          return token ? token.slice('language-'.length) : undefined;
        };
        const collectDirectListItems = element =>
          Array.from(element.children)
            .filter(child => child.tagName.toLowerCase() === 'li')
            .map(child => normalizeText(child.innerText || child.textContent || ''))
            .filter(Boolean);
        const collectTableRows = rows =>
          rows
            .map(row =>
              Array.from(row.children)
                .filter(cell => ['td', 'th'].includes(cell.tagName.toLowerCase()))
                .map(cell => normalizeText(cell.innerText || cell.textContent || '')),
            )
            .filter(cells => cells.length > 0);
        const blocks = [];
        const media = [];
        const selectors = 'h1, h2, h3, h4, h5, h6, p, a[href], img[src], video, ul, ol, blockquote, pre, code, table';
        const nodes = Array.from((document.body || document.documentElement).querySelectorAll(selectors));
        for (const node of nodes) {
          if (!(node instanceof Element))
            continue;
          const tagName = node.tagName.toLowerCase();
          const sectionPath = mergeSectionPath(inheritedSectionPath, toSectionPath(node, document.body || document.documentElement));
          if (/^h[1-6]$/.test(tagName)) {
            const text = normalizeText(node.textContent || '');
            if (text) blocks.push({ kind: 'heading', text, level: Number.parseInt(tagName.slice(1), 10), sectionPath });
            continue;
          }
          if (tagName === 'p') {
            const text = normalizeText(node.textContent || '');
            if (text) blocks.push({ kind: 'paragraph', text, sectionPath });
            continue;
          }
          if (tagName === 'a') {
            const url = typeof node.href === 'string' ? normalizeText(node.href) : '';
            const text = normalizeText(node.textContent || '');
            if (url) blocks.push({ kind: 'link', url, ...(text ? { text } : {}), sectionPath });
            continue;
          }
          if (tagName === 'img') {
            const url = typeof node.currentSrc === 'string' || typeof node.src === 'string'
              ? normalizeText(node.currentSrc || node.src)
              : '';
            if (url) {
              const block = { kind: 'image', url, sectionPath };
              blocks.push(block);
              media.push(block);
            }
            continue;
          }
          if (tagName === 'video') {
            const url = collectVideoUrl(node);
            if (url) {
              const block = { kind: 'video', url, sectionPath };
              blocks.push(block);
              media.push(block);
            }
            continue;
          }
          if (tagName === 'ul' || tagName === 'ol') {
            const items = collectDirectListItems(node);
            if (items.length) blocks.push({ kind: 'list', ordered: tagName === 'ol', items, sectionPath });
            continue;
          }
          if (tagName === 'blockquote') {
            const text = normalizeText(node.textContent || '');
            if (text) blocks.push({ kind: 'quote', text, sectionPath });
            continue;
          }
          if (tagName === 'pre' || tagName === 'code') {
            const text = readCodeText(node);
            if (text) {
              const languageHint = readCodeLanguage(node);
              blocks.push({ kind: 'code', text, ...(languageHint ? { languageHint } : {}), sectionPath });
            }
            continue;
          }
          if (tagName === 'table') {
            const headers = collectTableRows(Array.from(node.querySelectorAll('thead tr')))[0] ?? [];
            const rows = collectTableRows(Array.from(node.querySelectorAll('tbody tr')));
            if (headers.length || rows.length) blocks.push({ kind: 'table', headers, rows, sectionPath });
          }
        }
        return { blocks, media };
      }, inheritedSectionPath);
    };

    const collectSameOriginFrameDocumentFallback = async (frame, inheritedSectionPath) => {
      return await frame.evaluate((inheritedSectionPath) => {
        const normalizeText = value => String(value ?? '').replace(/\\s+/g, ' ').trim();
        const mergeSectionPath = (prefix, suffix) => {
          const merged = [...prefix, ...suffix]
            .filter(item => typeof item === 'string' && item.trim().length > 0)
            .map(item => item.trim());
          const deduped = [];
          for (const item of merged) {
            if (deduped[deduped.length - 1] !== item)
              deduped.push(item);
          }
          return deduped.slice(0, 4);
        };
        const readDirectHeadingText = element => {
          const heading = element.querySelector(
            ':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6'
          );
          return heading instanceof HTMLElement
            ? normalizeText(heading.innerText || heading.textContent || '')
            : '';
        };
        const toSectionPath = (node, boundaryRoot) => {
          const path = [];
          let current = node.parentElement;
          while (current && current !== boundaryRoot && path.length < 4) {
            const headingText = readDirectHeadingText(current);
            if (headingText && path[0] !== headingText)
              path.unshift(headingText);
            current = current.parentElement;
          }
          return path;
        };
        const root = document.body || document.documentElement;
        const blocks = [];
        const media = [];
        for (const node of Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a[href],img[src]'))) {
          const tagName = node.tagName.toLowerCase();
          const sectionPath = mergeSectionPath(inheritedSectionPath, toSectionPath(node, root));
          if (/^h[1-6]$/.test(tagName)) {
            const text = normalizeText(node.textContent || '');
            if (text) blocks.push({ kind: 'heading', text, level: Number.parseInt(tagName.slice(1), 10), sectionPath });
            continue;
          }
          if (tagName === 'p') {
            const text = normalizeText(node.textContent || '');
            if (text) blocks.push({ kind: 'paragraph', text, sectionPath });
            continue;
          }
          if (tagName === 'a') {
            const url = typeof node.href === 'string' ? normalizeText(node.href) : '';
            const text = normalizeText(node.textContent || '');
            if (url) blocks.push({ kind: 'link', url, ...(text ? { text } : {}), sectionPath });
            continue;
          }
          if (tagName === 'img') {
            const url = typeof node.currentSrc === 'string' || typeof node.src === 'string'
              ? normalizeText(node.currentSrc || node.src)
              : '';
            if (url) {
              const block = { kind: 'image', url, sectionPath };
              blocks.push(block);
              media.push(block);
            }
          }
        }
        return { blocks, media };
      }, inheritedSectionPath);
    };

    const extractPage = async () => {
      return await page.evaluate((recipe) => {
        const normalizeText = value => String(value ?? '').replace(/\\s+/g, ' ').trim();
        const isElementNode = node =>
          Boolean(node) && typeof node === 'object' && node.nodeType === Node.ELEMENT_NODE;
        const isHtmlLikeElement = node =>
          isElementNode(node)
          && typeof node.getBoundingClientRect === 'function'
          && typeof node.getClientRects === 'function';
        const isVisible = node => {
          if (!isHtmlLikeElement(node))
            return false;
          const ownerView = node.ownerDocument?.defaultView || window;
          const style = ownerView.getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')
            return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && node.getClientRects().length > 0;
        };
        const visibleNodes = (root, selector) => {
          const nodes = selector ? Array.from(root.querySelectorAll(selector)) : [root];
          const isExcluded = node => {
            if (!(node instanceof Element))
              return false;
            return recipe.excludeSelectors.some(selector =>
              node.matches(selector) || node.closest(selector)
            );
          };
          return nodes.filter(node => {
            if (isExcluded(node))
              return false;
            if (isHtmlLikeElement(node))
              return isVisible(node);
            if (typeof SVGElement !== 'undefined' && node instanceof SVGElement)
              return true;
            return false;
          });
        };
        const readNodeValue = (node, attr) => {
          if (attr) {
            if ((attr === 'href' || attr === 'src') && typeof node[attr] === 'string')
              return normalizeText(node[attr]);
            if (typeof node.getAttribute === 'function')
              return normalizeText(node.getAttribute(attr) ?? '');
            return '';
          }
          if (isHtmlLikeElement(node))
            return normalizeText(node.innerText || node.textContent || '');
          return normalizeText(node.textContent || '');
        };
        const resolveCompanionRoot = root => {
          if (!recipe.companionSelector || !(root instanceof Element))
            return null;
          let current = root.nextElementSibling;
          while (current) {
            if (current.matches(recipe.companionSelector))
              return current;
            current = current.nextElementSibling;
          }
          return null;
        };
        const extractField = (root, companionRoot, spec) => {
          const sourceRoot =
            spec.source === 'companion' && companionRoot instanceof Element
              ? companionRoot
              : root;
          const values = visibleNodes(sourceRoot, spec.selector)
            .map(node => readNodeValue(node, spec.attr))
            .filter(Boolean);
          if (spec.multiple)
            return values;
          return values[0] ?? null;
        };
        const extractRecord = root => {
          const companionRoot = resolveCompanionRoot(root);
          const record = {};
          for (const [fieldName, spec] of Object.entries(recipe.fields))
            record[fieldName] = extractField(root, companionRoot, spec);
          return record;
        };
        const collectVideoUrl = element => {
          if (!isElementNode(element) || element.tagName?.toLowerCase() !== 'video')
            return '';
          if (typeof element.currentSrc === 'string' && element.currentSrc.trim())
            return normalizeText(element.currentSrc);
          if (typeof element.src === 'string' && element.src.trim())
            return normalizeText(element.src);
          const source = element.querySelector('source[src]');
          if (source instanceof HTMLSourceElement && typeof source.src === 'string')
            return normalizeText(source.src);
          return '';
        };
        const readFigureCaption = element => {
          if (!(element instanceof Element))
            return undefined;
          const figure = element.closest('figure');
          if (!(figure instanceof HTMLElement))
            return undefined;
          const caption = Array.from(figure.children).find(child => child.tagName?.toLowerCase() === 'figcaption');
          if (!isHtmlLikeElement(caption) || !isVisible(caption))
            return undefined;
          const text = normalizeText(caption.innerText || caption.textContent || '');
          return text || undefined;
        };
        const collectVideoSources = element => {
          if (!(element instanceof HTMLVideoElement))
            return [];
          const sources = Array.from(element.querySelectorAll('source[src]'))
            .map(source =>
              typeof source.src === 'string'
                ? normalizeText(source.src)
                : normalizeText(source.getAttribute('src') ?? ''),
            )
            .filter(Boolean);
          return [...new Set(sources)];
        };
        const readImageDetails = element => {
          if (!isElementNode(element) || element.tagName?.toLowerCase() !== 'img')
            return null;
          const currentSrc =
            typeof element.currentSrc === 'string' ? normalizeText(element.currentSrc) : '';
          const src = typeof element.src === 'string' ? normalizeText(element.src) : '';
          const url = currentSrc || src;
          if (!url)
            return null;
          const srcset =
            typeof element.srcset === 'string' ? normalizeText(element.srcset) : '';
          const caption = readFigureCaption(element);
          return {
            url,
            ...(currentSrc ? { currentSrc } : {}),
            ...(srcset ? { srcset } : {}),
            ...(caption ? { caption } : {}),
          };
        };
        const readVideoDetails = element => {
          if (!isElementNode(element) || element.tagName?.toLowerCase() !== 'video')
            return null;
          const currentSrc =
            typeof element.currentSrc === 'string' ? normalizeText(element.currentSrc) : '';
          const src =
            typeof element.src === 'string' ? normalizeText(element.src) : '';
          const sources = collectVideoSources(element);
          const poster =
            typeof element.poster === 'string' ? normalizeText(element.poster) : '';
          const caption = readFigureCaption(element);
          const url = currentSrc || src || sources[0] || '';
          if (!url)
            return null;
          return {
            url,
            ...(currentSrc ? { currentSrc } : {}),
            ...(poster ? { poster } : {}),
            ...(sources.length > 0 ? { sources } : {}),
            ...(caption ? { caption } : {}),
          };
        };
        const shouldSkipParagraph = element =>
          Boolean(element.closest('blockquote, li, td, th, figcaption'));
        const shouldSkipStandaloneCode = element =>
          element.tagName.toLowerCase() === 'code' && Boolean(element.closest('pre'));
        const readDirectHeadingText = element => {
          if (!(element instanceof Element))
            return '';
          const heading = element.querySelector(
            ':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6'
          );
          if (!isHtmlLikeElement(heading) || !isVisible(heading))
            return '';
          return normalizeText(heading.innerText || heading.textContent || '');
        };
        const toSectionPath = (node, boundaryRoot) => {
          const path = [];
          let current = node.parentElement;
          while (current && current !== boundaryRoot && path.length < 4) {
            const headingText = readDirectHeadingText(current);
            if (headingText && path[0] !== headingText)
              path.unshift(headingText);
            current = current.parentElement;
          }
          return path;
        };
        const readCodeText = element =>
          String(
            isHtmlLikeElement(element)
              ? element.innerText || element.textContent || ''
              : element.textContent || ''
          ).trim();
        const readCodeLanguage = element => {
          const languageSource =
            element.tagName.toLowerCase() === 'pre'
              ? element.querySelector('code')
              : element;
          const className =
            typeof languageSource?.getAttribute === 'function'
              ? (languageSource.getAttribute('class') ?? '')
              : '';
          const classTokens = className.split(/\\s+/).filter(Boolean);
          const token = classTokens.find(item => item.startsWith('language-'));
          if (token)
            return token.slice('language-'.length);
          const datasetLanguage =
            typeof languageSource?.getAttribute === 'function'
              ? normalizeText(languageSource.getAttribute('data-language') ?? '')
              : '';
          return datasetLanguage || undefined;
        };
        const readTableCaption = table => {
          if (!isElementNode(table) || table.tagName?.toLowerCase() !== 'table')
            return undefined;
          const caption = table.caption;
          if (!caption)
            return undefined;
          if (!isVisible(caption))
            return undefined;
          const text = normalizeText(caption.innerText || caption.textContent || '');
          return text || undefined;
        };
        const collectDirectListItems = element =>
          Array.from(element.children)
            .filter(child => child.tagName.toLowerCase() === 'li' && isVisible(child))
            .map(child => normalizeText(child.innerText || child.textContent || ''))
            .filter(Boolean);
        const collectTableRows = rows =>
          rows
            .map(row =>
              Array.from(row.children)
                .filter(cell => {
                  const tagName = cell.tagName.toLowerCase();
                  return (tagName === 'td' || tagName === 'th') && isVisible(cell);
                })
                .map(cell => normalizeText(cell.innerText || cell.textContent || '')),
            )
            .filter(cells => cells.length > 0);
        const collectDocument = roots => {
          const blocks = [];
          const media = [];
          const limitations = [];
          const seenMedia = new Set();
          const seenFrameDocuments = new WeakSet();
          const selectors =
            'h1, h2, h3, h4, h5, h6, p, a[href], img[src], video, ul, ol, blockquote, pre, code, table, iframe, frame';
          const isExcluded = node => {
            if (!(node instanceof Element))
              return false;
            return recipe.excludeSelectors.some(selector =>
              node.matches(selector) || node.closest(selector)
            );
          };

          const pushLimitation = limitation => {
            if (typeof limitation !== 'string' || !limitation || limitations.includes(limitation))
              return;
            limitations.push(limitation);
          };

          const mergeSectionPath = (prefix, suffix) => {
            const merged = [...prefix, ...suffix]
              .filter(item => typeof item === 'string' && item.trim().length > 0)
              .map(item => item.trim());
            const deduped = [];
            for (const item of merged) {
              if (deduped[deduped.length - 1] !== item)
                deduped.push(item);
            }
            return deduped.slice(0, 4);
          };

          const pushMedia = entry => {
            const key = entry.kind + ':' + entry.url;
            if (seenMedia.has(key))
              return;
            seenMedia.add(key);
            media.push(entry);
          };

          const pushBlock = block => {
            blocks.push(block);
            if (block.kind === 'image' || block.kind === 'video')
              pushMedia(block);
          };

          const collectFrameRoot = (node, boundaryRoot, inheritedSectionPath) => {
            let frameDocument = null;
            try {
              frameDocument = node.contentDocument || node.contentWindow?.document || null;
            } catch {
              pushLimitation('cross-origin iframe content is not extracted');
              return;
            }
            if (!frameDocument || !frameDocument.documentElement)
              return;
            if (seenFrameDocuments.has(frameDocument))
              return;
            seenFrameDocuments.add(frameDocument);

            const frameRoot = frameDocument.body || frameDocument.documentElement;
            if (!frameRoot)
              return;
            collectRoot(
              frameRoot,
              frameRoot,
              mergeSectionPath(inheritedSectionPath, toSectionPath(node, boundaryRoot)),
              true,
            );
          };

          const collectRoot = (root, boundaryRoot, inheritedSectionPath, relaxedVisibility = false) => {
            const nodes = [
              ...(isElementNode(root) && typeof root.matches === 'function' && root.matches(selectors) ? [root] : []),
              ...Array.from(root.querySelectorAll(selectors)),
            ];
            for (const node of nodes) {
              if (!isElementNode(node))
                continue;
              if (isExcluded(node))
                continue;
              const tagName = node.tagName.toLowerCase();

              if (!relaxedVisibility && isHtmlLikeElement(node) && !isVisible(node))
                continue;

              if (tagName === 'iframe' || tagName === 'frame') {
                collectFrameRoot(node, boundaryRoot, inheritedSectionPath);
                continue;
              }

              const sectionPath = mergeSectionPath(
                inheritedSectionPath,
                toSectionPath(node, boundaryRoot),
              );

              if (/^h[1-6]$/.test(tagName)) {
                const text = normalizeText(node.textContent || '');
                if (!text)
                  continue;
                pushBlock({
                  kind: 'heading',
                  text,
                  level: Number.parseInt(tagName.slice(1), 10),
                  sectionPath,
                });
                continue;
              }

              if (tagName === 'p') {
                if (shouldSkipParagraph(node))
                  continue;
                const text = normalizeText(node.textContent || '');
                if (!text)
                  continue;
                pushBlock({
                  kind: 'paragraph',
                  text,
                  sectionPath,
                });
                continue;
              }

              if (tagName === 'a') {
                const url =
                  typeof node.href === 'string' ? normalizeText(node.href) : '';
                if (!url)
                  continue;
                const text = normalizeText(node.textContent || '');
                pushBlock({
                  kind: 'link',
                  url,
                  ...(text ? { text } : {}),
                  sectionPath,
                });
                continue;
              }

              if (tagName === 'img') {
                const mediaEntry = readImageDetails(node);
                if (!mediaEntry)
                  continue;
                pushBlock({
                  kind: 'image',
                  ...mediaEntry,
                  sectionPath,
                });
                continue;
              }

              if (tagName === 'video') {
                const mediaEntry = readVideoDetails(node);
                if (!mediaEntry)
                  continue;
                pushBlock({
                  kind: 'video',
                  ...mediaEntry,
                  sectionPath,
                });
                continue;
              }

              if (tagName === 'ul' || tagName === 'ol') {
                const items = collectDirectListItems(node).filter(Boolean);
                if (items.length === 0)
                  continue;
                pushBlock({
                  kind: 'list',
                  ordered: tagName === 'ol',
                  items,
                  sectionPath,
                });
                continue;
              }

              if (tagName === 'blockquote') {
                const text = normalizeText(node.textContent || '');
                if (!text)
                  continue;
                pushBlock({
                  kind: 'quote',
                  text,
                  sectionPath,
                });
                continue;
              }

              if (tagName === 'pre' || tagName === 'code') {
                if (shouldSkipStandaloneCode(node))
                  continue;
                const text = readCodeText(node);
                if (!text)
                  continue;
                const languageHint = readCodeLanguage(node);
                pushBlock({
                  kind: 'code',
                  text,
                  ...(languageHint ? { languageHint } : {}),
                  sectionPath,
                });
                continue;
              }

              if (tagName === 'table') {
                const table = node.tagName?.toLowerCase() === 'table' ? node : null;
                if (!table)
                  continue;
                const headerRows = collectTableRows(Array.from(table.tHead?.rows ?? []));
                const headers =
                  headerRows[0]
                  ?? collectTableRows(Array.from(table.querySelectorAll('tr')))
                    .find(row => row.length > 0)
                  ?? [];
                const bodyRows = collectTableRows(Array.from(table.tBodies).flatMap(section => Array.from(section.rows)));
                const fallbackRows =
                  bodyRows.length > 0
                    ? bodyRows
                    : collectTableRows(Array.from(table.querySelectorAll('tr'))).slice(headerRows.length > 0 ? 1 : 0);
                if (headers.length === 0 && fallbackRows.length === 0)
                  continue;
                const caption = readTableCaption(table);
                pushBlock({
                  kind: 'table',
                  headers,
                  rows: fallbackRows,
                  ...(caption ? { caption } : {}),
                  sectionPath,
                });
              }
            }
          };

          for (const root of roots) {
            collectRoot(root, root, []);
          }

          return { blocks, media, limitations };
        };
        const flattenDocuments = documents => {
          const flattened = {
            blocks: [],
            media: [],
            limitations: [],
          };
          for (const documentEntry of documents) {
            if (!documentEntry || typeof documentEntry !== 'object')
              continue;
            if (Array.isArray(documentEntry.blocks))
              flattened.blocks.push(...documentEntry.blocks);
            if (Array.isArray(documentEntry.media))
              flattened.media.push(...documentEntry.media);
            if (Array.isArray(documentEntry.limitations))
              flattened.limitations.push(...documentEntry.limitations);
          }
          return flattened;
        };
        const listRoots = recipe.kind === 'list'
          ? visibleNodes(document, recipe.itemSelector)
          : [];
        const articleRoot =
          recipe.kind === 'article'
            ? visibleNodes(document, recipe.containerSelector)[0] ?? null
            : null;
        const itemDocuments = recipe.kind === 'list'
          ? listRoots.map(root => collectDocument([root]))
          : [];
        const documentPayload = recipe.kind === 'list'
          ? flattenDocuments(itemDocuments)
          : collectDocument(articleRoot ? [articleRoot] : []);
        const items = recipe.kind === 'list'
          ? listRoots.map(extractRecord)
          : articleRoot
            ? [extractRecord(articleRoot)]
            : [];

        const sanitize = (value, depth, seen) => {
          if (value == null || typeof value === 'boolean' || typeof value === 'number')
            return value;
          if (typeof value === 'string')
            return value.length > 1000 ? value.slice(0, 1000) : value;
          if (depth >= 4)
            return Array.isArray(value) ? '[truncated-array]' : '[truncated-object]';
          if (typeof value === 'function')
            return '[function]';
          if (typeof value !== 'object')
            return String(value);
          if (seen.has(value))
            return '[circular]';
          seen.add(value);
          if (Array.isArray(value))
            return value.slice(0, 20).map(item => sanitize(item, depth + 1, seen));
          const entries = Object.entries(value).slice(0, 20);
          const output = {};
          for (const [key, item] of entries)
            output[key] = sanitize(item, depth + 1, seen);
          return output;
        };

        let runtimeProbe;
        if (recipe.runtimeGlobal) {
          const segments = recipe.runtimeGlobal.split('.');
          let current = window;
          let found = true;
          for (const segment of segments) {
            if (current == null || !(segment in current)) {
              found = false;
              break;
            }
            current = current[segment];
          }
          runtimeProbe = {
            path: recipe.runtimeGlobal,
            found,
            ...(found ? { value: sanitize(current, 0, new WeakSet()) } : {}),
          };
        }

        return {
          page: {
            url: location.href,
            title: document.title,
          },
          items,
          document: documentPayload,
          ...(itemDocuments.length > 0 ? { itemDocuments } : {}),
          ...(runtimeProbe ? { runtimeProbe } : {}),
        };
      }, recipe);
    };

    const aggregatedRecords = [];
    const aggregatedDocument = {
      blocks: [],
      media: [],
    };
    const aggregatedLimitations = new Set();
    const seenSnapshots = new Set();
    const seenRecordFingerprints = new Set();
    const seenBlockFingerprints = new Set();
    const seenMediaFingerprints = new Set();
    const selectedRecordDocuments = new Map();
    let lastPayload;
    let pageCount = 0;
    let scrollStepsUsed = 0;
    let dedupedBlockCount = 0;
    let currentPageUrl = null;
    let currentPageDocument = {
      blocks: [],
      media: [],
    };
    let currentPageDedupedBlockCount = 0;

    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);
    await page.waitForTimeout(200).catch(() => null);

    const fingerprintValue = value => JSON.stringify(value);
    const flattenDocuments = documents => {
      const flattened = {
        blocks: [],
        media: [],
      };
      for (const documentEntry of documents) {
        if (!documentEntry || typeof documentEntry !== 'object')
          continue;
        if (Array.isArray(documentEntry.blocks))
          flattened.blocks.push(...documentEntry.blocks);
        if (Array.isArray(documentEntry.media))
          flattened.media.push(...documentEntry.media);
      }
      return flattened;
    };

    const documentForItemCount = (payload, itemCount) => {
      if (Array.isArray(payload.itemDocuments) && payload.itemDocuments.length > 0) {
        return flattenDocuments(payload.itemDocuments.slice(0, itemCount));
      }
      return {
        blocks: Array.isArray(payload.document?.blocks) ? payload.document.blocks : [],
        media: Array.isArray(payload.document?.media) ? payload.document.media : [],
      };
    };

    const appendUniqueEntries = (target, entries, seenFingerprints) => {
      let duplicates = 0;
      for (const entry of entries) {
        const fingerprint = fingerprintValue(entry);
        if (seenFingerprints.has(fingerprint)) {
          duplicates += 1;
          continue;
        }
        seenFingerprints.add(fingerprint);
        target.push(entry);
      }
      return duplicates;
    };

    const dedupeEntries = entries => {
      const deduped = [];
      const seenFingerprints = new Set();
      let duplicates = 0;
      for (const entry of entries) {
        const fingerprint = fingerprintValue(entry);
        if (seenFingerprints.has(fingerprint)) {
          duplicates += 1;
          continue;
        }
        seenFingerprints.add(fingerprint);
        deduped.push(entry);
      }
      return {
        entries: deduped,
        duplicates,
      };
    };

    const buildSelectedPageDocument = (payload, selectedRecordFingerprints) => {
      if (Array.isArray(payload.itemDocuments) && payload.itemDocuments.length > 0) {
        const blocks = [];
        const media = [];
        const itemCount = Math.min(payload.items.length, payload.itemDocuments.length);
        for (let index = 0; index < itemCount; index += 1) {
          const item = payload.items[index];
          const fingerprint = fingerprintValue(item);
          if (!selectedRecordFingerprints.has(fingerprint))
            continue;
          const documentEntry = flattenDocuments([payload.itemDocuments[index]]);
          if (documentEntry.blocks.length > 0)
            blocks.push(...documentEntry.blocks);
          if (documentEntry.media.length > 0)
            media.push(...documentEntry.media);
        }
        const dedupedBlocks = dedupeEntries(blocks);
        const dedupedMedia = dedupeEntries(media);
        return {
          document: {
            blocks: dedupedBlocks.entries,
            media: dedupedMedia.entries,
          },
          dedupedBlockCount: dedupedBlocks.duplicates,
        };
      }

      const nextDocument = documentForItemCount(payload, aggregatedRecords.length);
      const dedupedBlocks = dedupeEntries(nextDocument.blocks);
      const dedupedMedia = dedupeEntries(nextDocument.media);
      return {
        document: {
          blocks: dedupedBlocks.entries,
          media: dedupedMedia.entries,
        },
        dedupedBlockCount: dedupedBlocks.duplicates,
      };
    };

    const flushCurrentPageDocument = () => {
      if (currentPageDocument.blocks.length === 0 && currentPageDocument.media.length === 0)
        return;
      dedupedBlockCount += currentPageDedupedBlockCount;
      dedupedBlockCount += appendUniqueEntries(
        aggregatedDocument.blocks,
        currentPageDocument.blocks,
        seenBlockFingerprints,
      );
      appendUniqueEntries(aggregatedDocument.media, currentPageDocument.media, seenMediaFingerprints);
      currentPageDocument = {
        blocks: [],
        media: [],
      };
      currentPageDedupedBlockCount = 0;
    };

    const dedupePayloadRecords = payload => {
      if (!Array.isArray(payload.items) || payload.items.length === 0)
        return [];
      const deduped = [];
      const seenPayloadFingerprints = new Set();
      for (const item of payload.items) {
        const fingerprint = fingerprintValue(item);
        if (seenPayloadFingerprints.has(fingerprint))
          continue;
        seenPayloadFingerprints.add(fingerprint);
        deduped.push({
          fingerprint,
          record: item,
        });
      }
      return deduped;
    };

    const appendNewRecords = payload => {
      if (!Array.isArray(payload.items) || payload.items.length === 0)
        return;
      const remainingSlots = Math.max(recipe.limit - aggregatedRecords.length, 0);
      if (remainingSlots <= 0)
        return;
      const nextRecords = [];
      for (const entry of dedupePayloadRecords(payload)) {
        if (seenRecordFingerprints.has(entry.fingerprint))
          continue;
        nextRecords.push(entry);
        if (nextRecords.length >= remainingSlots)
          break;
      }
      for (const entry of nextRecords) {
        seenRecordFingerprints.add(entry.fingerprint);
        aggregatedRecords.push(entry.record);
      }
    };

    const updateSelectedRecordDocuments = payload => {
      if (!Array.isArray(payload.itemDocuments) || payload.itemDocuments.length === 0)
        return;
      const itemCount = Math.min(payload.items.length, payload.itemDocuments.length);
      for (let index = 0; index < itemCount; index += 1) {
        const item = payload.items[index];
        const fingerprint = fingerprintValue(item);
        if (!seenRecordFingerprints.has(fingerprint))
          continue;
        selectedRecordDocuments.set(
          fingerprint,
          flattenDocuments([payload.itemDocuments[index]]),
        );
      }
    };

    const buildAggregatedSelectedDocument = () => {
      const flattened = flattenDocuments(Array.from(selectedRecordDocuments.values()));
      const dedupedBlocks = dedupeEntries(flattened.blocks);
      const dedupedMedia = dedupeEntries(flattened.media);
      return {
        document: {
          blocks: dedupedBlocks.entries,
          media: dedupedMedia.entries,
        },
        dedupedBlockCount: dedupedBlocks.duplicates,
      };
    };

    const canScrollFurther = async () => {
      if (
        recipe.kind !== 'list' ||
        !recipe.scroll ||
        recipe.scroll.mode !== 'until-stable' ||
        scrollStepsUsed >= recipe.scroll.maxSteps ||
        aggregatedRecords.length >= recipe.limit
      ) {
        return false;
      }
      if (recipe.pagination?.mode === 'load-more')
        return true;
      return page.evaluate(() => {
        const root = document.scrollingElement || document.documentElement || document.body;
        if (!root)
          return false;
        const maxScrollTop = Math.max(root.scrollHeight - window.innerHeight, 0);
        return window.scrollY + 1 < maxScrollTop;
      });
    };

    while (true) {
      if (recipe.kind === 'list' && aggregatedRecords.length >= recipe.limit)
        break;

      const payload = await extractPage();
      if (currentPageUrl && payload.page?.url && currentPageUrl !== payload.page.url)
        flushCurrentPageDocument();
      currentPageUrl = payload.page?.url ?? currentPageUrl;
      const fingerprint = JSON.stringify({
        page: payload.page,
        items: payload.items,
        document: payload.document,
      });
      const isNewSnapshot = !seenSnapshots.has(fingerprint);
      lastPayload = payload;
      if (isNewSnapshot) {
        seenSnapshots.add(fingerprint);
        pageCount += 1;
        for (const limitation of Array.isArray(payload.document?.limitations) ? payload.document.limitations : []) {
          if (typeof limitation === 'string' && limitation)
            aggregatedLimitations.add(limitation);
        }
        if (recipe.kind === 'list') {
          appendNewRecords(payload);
          updateSelectedRecordDocuments(payload);
          const nextPageDocument =
            recipe.pagination?.mode === 'next-page'
              ? buildSelectedPageDocument(payload, seenRecordFingerprints)
              : buildAggregatedSelectedDocument();
          currentPageDocument = nextPageDocument.document;
          currentPageDedupedBlockCount = nextPageDocument.dedupedBlockCount;
        } else {
          aggregatedRecords.splice(0, aggregatedRecords.length, ...payload.items.slice(0, recipe.limit));
          aggregatedDocument.blocks.splice(0, aggregatedDocument.blocks.length, ...payload.document.blocks);
          aggregatedDocument.media.splice(0, aggregatedDocument.media.length, ...payload.document.media);
        }
      }

      if (recipe.kind === 'list' && aggregatedRecords.length >= recipe.limit)
        break;

      const scrollPossible = await canScrollFurther();

      const canTraverseNextPage =
        recipe.kind === 'list' &&
        recipe.pagination &&
        recipe.pagination.mode === 'next-page' &&
        pageCount < recipe.pagination.maxPages &&
        aggregatedRecords.length < recipe.limit &&
        !scrollPossible;

      if (canTraverseNextPage) {
        const nextPageLink = page.locator(recipe.pagination.selector).first();
        if ((await nextPageLink.count()) < 1)
          break;
        const isVisible = await nextPageLink.isVisible().catch(() => false);
        const isEnabled = await nextPageLink.isEnabled().catch(() => false);
        if (!isVisible || !isEnabled)
          break;

        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => null),
          nextPageLink.click(),
        ]);
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);
        continue;
      }

      const canLoadMore =
        recipe.kind === 'list' &&
        recipe.pagination &&
        recipe.pagination.mode === 'load-more' &&
        pageCount < recipe.pagination.maxPages &&
        aggregatedRecords.length < recipe.limit;
      if (canLoadMore) {
        const loadMoreButton = page.locator(recipe.pagination.selector).first();
        if ((await loadMoreButton.count()) < 1) {
          if (!scrollPossible)
            break;
        } else {
          const isVisible = await loadMoreButton.isVisible().catch(() => false);
          const isEnabled = await loadMoreButton.isEnabled().catch(() => false);
          if (isVisible && isEnabled) {
            await loadMoreButton.click();
            await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);
            await page.waitForTimeout(250);
            continue;
          }
          if (!scrollPossible)
            break;
        }
      }

      const canScroll =
        recipe.kind === 'list' &&
        recipe.scroll &&
        recipe.scroll.mode === 'until-stable' &&
        scrollStepsUsed < recipe.scroll.maxSteps &&
        aggregatedRecords.length < recipe.limit &&
        scrollPossible;
      if (canScroll) {
        await page.evaluate((stepPx) => {
          window.scrollBy(0, stepPx);
          window.dispatchEvent(new Event('scroll'));
        }, recipe.scroll.stepPx);
        scrollStepsUsed += 1;
        const settleMs = Math.max(recipe.scroll.settleMs, 700);
        if (settleMs > 0)
          await page.waitForTimeout(settleMs);
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);
        continue;
      }

      break;
    }

    flushCurrentPageDocument();

    const currentPage =
      lastPayload?.page ?? {
        url: page.url(),
        title: await page.title(),
      };
    const traversal = {};
    if (recipe.pagination) {
      traversal.pageCount = pageCount;
      traversal.paginationMode = recipe.pagination.mode;
      traversal.maxPages = recipe.pagination.maxPages;
    }
    if (recipe.scroll) {
      traversal.scrollMode = recipe.scroll.mode;
      traversal.scrollSteps = scrollStepsUsed;
      traversal.scrollStepsUsed = scrollStepsUsed;
      traversal.maxScrollSteps = recipe.scroll.maxSteps;
    }
    traversal.dedupedBlockCount = dedupedBlockCount;

    return JSON.stringify({
      page: currentPage,
      items: aggregatedRecords,
      document: aggregatedDocument,
      ...(aggregatedLimitations.size > 0
        ? {
            limitation: Array.from(aggregatedLimitations).join('; '),
            limitations: Array.from(aggregatedLimitations),
          }
        : {}),
      ...(lastPayload?.runtimeProbe ? { runtimeProbe: lastPayload.runtimeProbe } : {}),
      ...(Object.keys(traversal).length > 0 ? { traversal } : {}),
    });
  }`;
}
