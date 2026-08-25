/* ==================================================================
   편한 펫택시&피크닉 — 동작

   외부 라이브러리 없음 · 백엔드 없음 · 순수 자바스크립트
   내용을 바꾸려면 site.js 와 reviews.js 를 고치세요. 이 파일은 동작만 담습니다.
   ================================================================== */

(function () {
    'use strict';

    /* ---------------------------------------------------------------- */
    /* 도우미                                                            */
    /* ---------------------------------------------------------------- */

    function $(id)  { return document.getElementById(id); }
    function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function esc(t) {
        return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function telDigits(t) { return String(t).replace(/[^0-9]/g, ''); }

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    /* 모바일인지 — 전화 걸기·메시지 보내기가 실제로 되는 환경인지 판단합니다 */
    var isMobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                   (window.matchMedia('(pointer: coarse)').matches &&
                    window.matchMedia('(max-width: 1024px)').matches);
    document.body.classList.toggle('is-desktop', !isMobile);


    /* ================================================================
       1. 사진이 없어도 화면이 깨지지 않게
          images 폴더에서 파일을 지워도 빈 칸만 사라지고 나머지는 그대로입니다.
       ================================================================ */

    function guard(img, onGone) {
        img.addEventListener('error', function () {
            var box = onGone || img.closest('.car-card, .germ-cell, figure, .shot');
            if (box && box.parentNode) { box.parentNode.removeChild(box); }
        });
    }


    /* ================================================================
       2. 사진 확대 (라이트박스)
          핀치 줌 · 더블탭 줌 · 좌우 스와이프 · 아래로 밀어 닫기 · 키보드
       ================================================================ */

    var GROUPS = {};          /* { 그룹이름: [ {src, cap, sub, alt}, ... ] } */

    var lb, lbImg, lbCount, lbCapT, lbCapS, lbStage;
    var lbList = [], lbIdx = 0, lbLast = null;
    var sc = 1, tx = 0, ty = 0;                 /* 확대율 · 이동 */
    var startD = 0, startSc = 1, startX = 0, startY = 0, baseTx = 0, baseTy = 0;
    var dragging = false, pinching = false, moved = 0, lastTap = 0;

    function buildLightbox() {
        lb = document.createElement('div');
        lb.className = 'lb';
        lb.setAttribute('role', 'dialog');
        lb.setAttribute('aria-modal', 'true');
        lb.setAttribute('aria-label', '사진 크게 보기');
        lb.innerHTML =
            '<div class="lb-stage"><img class="lb-img" alt=""></div>' +
            '<div class="lb-bar">' +
                '<span class="lb-count"></span><span class="lb-sp"></span>' +
                '<button class="lb-btn" type="button" data-lb-close aria-label="닫기">' +
                    '<span class="ic ic-close" aria-hidden="true"></span></button>' +
            '</div>' +
            '<button class="lb-nav lb-prev" type="button" data-lb-prev aria-label="이전 사진">' +
                '<span class="ic ic-arrow" aria-hidden="true"></span></button>' +
            '<button class="lb-nav lb-next" type="button" data-lb-next aria-label="다음 사진">' +
                '<span class="ic ic-arrow" aria-hidden="true"></span></button>' +
            '<figcaption class="lb-cap"><b></b><span></span></figcaption>';
        document.body.appendChild(lb);

        lbStage = lb.querySelector('.lb-stage');
        lbImg   = lb.querySelector('.lb-img');
        lbCount = lb.querySelector('.lb-count');
        lbCapT  = lb.querySelector('.lb-cap b');
        lbCapS  = lb.querySelector('.lb-cap span');

        lb.querySelector('[data-lb-close]').addEventListener('click', closeLb);
        lb.querySelector('[data-lb-prev]').addEventListener('click', function () { go(-1); });
        lb.querySelector('[data-lb-next]').addEventListener('click', function () { go(1); });

        /* 배경을 누르면 닫힙니다 (사진 자체를 누른 건 제외) */
        lbStage.addEventListener('click', function (e) {
            if (e.target === lbStage && sc === 1) { closeLb(); }
        });

        bindGestures();
    }

    function apply(anim) {
        lbImg.style.transition = anim && !reduceMotion.matches ? 'transform .25s cubic-bezier(.22,1,.36,1)' : 'none';
        lbImg.style.transform = 'translate(-50%,-50%) translate(' + tx + 'px,' + ty + 'px) scale(' + sc + ')';
    }

    function reset(anim) { sc = 1; tx = 0; ty = 0; apply(anim); }

    function show(i) {
        lbIdx = (i + lbList.length) % lbList.length;
        var it = lbList[lbIdx];
        lbImg.src = it.src;
        lbImg.alt = it.alt || it.cap || '';
        lbCapT.textContent = it.cap || '';
        lbCapS.textContent = it.sub || '';
        lbCount.textContent = (lbIdx + 1) + ' / ' + lbList.length;
        var many = lbList.length > 1;
        lb.querySelector('.lb-prev').style.display = many ? '' : 'none';
        lb.querySelector('.lb-next').style.display = many ? '' : 'none';
        reset(false);
    }

    function go(step) { if (lbList.length > 1) { show(lbIdx + step); } }

    function openLb(group, index, opener) {
        if (!lb) { buildLightbox(); }
        lbList = GROUPS[group] || [];
        if (!lbList.length) { return; }
        lbLast = opener || null;
        lb.classList.add('is-on');
        document.body.classList.add('lb-open');
        show(index || 0);
        lb.querySelector('[data-lb-close]').focus();
        document.addEventListener('keydown', onKey);
    }

    function closeLb() {
        lb.classList.remove('is-on');
        document.body.classList.remove('lb-open');
        document.removeEventListener('keydown', onKey);
        if (lbLast) { lbLast.focus(); lbLast = null; }
    }

    function onKey(e) {
        if (e.key === 'Escape')     { closeLb(); }
        if (e.key === 'ArrowLeft')  { go(-1); }
        if (e.key === 'ArrowRight') { go(1); }
        /* 포커스가 밖으로 나가지 않게 잡아 둡니다 */
        if (e.key === 'Tab') {
            var f = all('button', lb).filter(function (b) { return b.offsetParent !== null; });
            if (!f.length) { return; }
            var first = f[0], last = f[f.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
    }

    function dist(t) {
        var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function bindGestures() {
        /* ── 터치 ── */
        lbStage.addEventListener('touchstart', function (e) {
            if (e.touches.length === 2) {
                pinching = true; dragging = false;
                startD = dist(e.touches); startSc = sc;
            } else if (e.touches.length === 1) {
                dragging = true; pinching = false; moved = 0;
                startX = e.touches[0].clientX; startY = e.touches[0].clientY;
                baseTx = tx; baseTy = ty;
            }
        }, { passive: true });

        lbStage.addEventListener('touchmove', function (e) {
            if (pinching && e.touches.length === 2) {
                e.preventDefault();
                sc = clamp(startSc * (dist(e.touches) / startD), 1, 5);
                if (sc === 1) { tx = 0; ty = 0; }
                apply(false);
            } else if (dragging && e.touches.length === 1) {
                var dx = e.touches[0].clientX - startX;
                var dy = e.touches[0].clientY - startY;
                moved = Math.abs(dx) + Math.abs(dy);
                if (sc > 1) {
                    e.preventDefault();
                    tx = baseTx + dx; ty = baseTy + dy;
                    apply(false);
                }
            }
        }, { passive: false });

        lbStage.addEventListener('touchend', function (e) {
            if (pinching && e.touches.length < 2) {
                pinching = false;
                if (sc < 1.08) { reset(true); }
            }
            if (dragging && !e.touches.length) {
                dragging = false;
                var dx = (e.changedTouches[0] || {}).clientX - startX;
                var dy = (e.changedTouches[0] || {}).clientY - startY;

                if (sc === 1) {
                    /* 확대 안 한 상태에서만 넘기기·닫기가 동작합니다 */
                    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy)) { go(dx < 0 ? 1 : -1); }
                    else if (dy > 90) { closeLb(); }
                }
                /* 더블탭 확대 */
                if (moved < 10) {
                    var now = Date.now();
                    if (now - lastTap < 300) {
                        if (sc > 1) { reset(true); } else { sc = 2.4; apply(true); }
                        lastTap = 0;
                    } else { lastTap = now; }
                }
            }
        }, { passive: true });

        /* ── 마우스 (데스크톱) ── */
        lbImg.addEventListener('dblclick', function () {
            if (sc > 1) { reset(true); } else { sc = 2.2; apply(true); }
        });
        lbImg.addEventListener('mousedown', function (e) {
            if (sc <= 1) { return; }
            e.preventDefault();
            dragging = true; startX = e.clientX; startY = e.clientY; baseTx = tx; baseTy = ty;
            lbImg.classList.add('is-drag');
        });
        window.addEventListener('mousemove', function (e) {
            if (!dragging || sc <= 1) { return; }
            tx = baseTx + (e.clientX - startX); ty = baseTy + (e.clientY - startY); apply(false);
        });
        window.addEventListener('mouseup', function () {
            dragging = false; lbImg.classList.remove('is-drag');
        });
        lbStage.addEventListener('wheel', function (e) {
            e.preventDefault();
            sc = clamp(sc * (e.deltaY < 0 ? 1.12 : 0.89), 1, 5);
            if (sc === 1) { tx = 0; ty = 0; }
            apply(false);
        }, { passive: false });
    }

    /* 사진 버튼 하나를 만듭니다 */
    function shotHTML(it, group, i, ratioClass) {
        return '<button class="shot ' + (ratioClass || '') + '" type="button" ' +
                    'data-lb="' + esc(group) + '" data-i="' + i + '" ' +
                    'aria-label="' + esc(it.cap || '사진') + ' 크게 보기">' +
                '<img src="' + esc(it.src) + '" alt="' + esc(it.alt || it.cap || '') + '" loading="lazy">' +
                (it.cap ? '<span class="shot-cap"><b>' + esc(it.cap) + '</b>' +
                          (it.sub ? '<span>' + esc(it.sub) + '</span>' : '') + '</span>' : '') +
            '</button>';
    }

    /* 만들어 둔 사진 버튼에 확대 동작을 붙입니다 */
    function wireShots(root) {
        all('.shot[data-lb]', root).forEach(function (btn) {
            btn.addEventListener('click', function () {
                openLb(btn.getAttribute('data-lb'), parseInt(btn.getAttribute('data-i'), 10), btn);
            });
            var img = btn.querySelector('img');
            if (img) { guard(img); }
        });
    }


    /* ================================================================
       3. 갤러리 — site.js 의 목록을 그대로 그립니다
       ================================================================ */

    if (typeof CAR_PHOTOS !== 'undefined') { GROUPS.car = CAR_PHOTOS; }
    if (typeof CLEAN_PHOTOS !== 'undefined') { GROUPS.clean = CLEAN_PHOTOS; }
    if (typeof GERM_PHOTOS !== 'undefined') { GROUPS.germ = GERM_PHOTOS; }
    if (typeof PICNIC_PHOTOS !== 'undefined') { GROUPS.picnic = PICNIC_PHOTOS; }

    var carRail = $('car-rail');
    if (carRail && GROUPS.car) {
        carRail.innerHTML = GROUPS.car.map(function (it, i) {
            return '<div class="photo-card">' + shotHTML(it, 'car', i) + '</div>';
        }).join('');
        wireShots(carRail);
    }

    var cleanRail = $('clean-rail');
    if (cleanRail && GROUPS.clean) {
        cleanRail.innerHTML = GROUPS.clean.map(function (it, i) {
            return '<div class="photo-card">' + shotHTML(it, 'clean', i) + '</div>';
        }).join('');
        wireShots(cleanRail);
    }

    var picnicGrid = $('picnic-grid');
    if (picnicGrid && GROUPS.picnic) {
        picnicGrid.innerHTML = GROUPS.picnic.map(function (it, i) {
            return shotHTML(it, 'picnic', i);
        }).join('');
        wireShots(picnicGrid);
    }

    var germRail = $('germ-rail');
    if (germRail && GROUPS.germ) {
        germRail.innerHTML = GROUPS.germ.map(function (it, i) {
            return '<div class="photo-card">' + shotHTML(it, 'germ', i) + '</div>';
        }).join('');
        wireShots(germRail);
    }


    /* 페이지에 직접 적어 둔 사진에도 확대를 붙입니다 */
    wireShots(document);


    /* ================================================================
       4. 이용후기 — 네이버 플레이스 실제 후기
          네이버 반려동물 분류에는 별점이 없어 후기 글 자체를 보여 줍니다.
       ================================================================ */

    if (typeof REVIEWS !== 'undefined' && REVIEWS.length) {


        function byline(r) {
            /* 작성일은 표시하지 않습니다 (reviews.js 의 date 값은 그대로 보관) */
            return '<p class="rv-by"><b>' + esc(r.name) + '</b> 고객님' +
                   (r.visit >= 2 ? ' · 재방문 ' + r.visit + '회' : '') + '</p>';
        }

        var rvRail = $('review-rail');
        if (rvRail) {
            rvRail.innerHTML = REVIEWS.slice(0, 8).map(function (r) {
                return '<article class="rv"><p class="rv-txt">' + esc(r.text) + '</p>' + byline(r) + '</article>';
            }).join('');
        }

        var rvList = $('rv-list');
        if (rvList) {
            rvList.innerHTML = REVIEWS.map(function (r) {
                return '<article class="rv-item">' +
                    '<p class="rv-txt">' + esc(r.text) + '</p>' + byline(r) +
                    (r.reply ? '<div class="rv-reply"><b>사장님 답글</b>' + esc(r.reply) + '</div>' : '') +
                '</article>';
            }).join('');
        }

        var rvCount = $('rv-count');
        if (rvCount) { rvCount.textContent = REVIEWS.length; }
    }


    /* ================================================================
       4-2. 가로 레일 — 손가락으로도, 마우스로도 넘길 수 있게
            데스크톱에서는 끌어서 스크롤 + 좌우 화살표를 붙입니다.
       ================================================================ */

    all('.rail, .cards').forEach(function (rail) {
        if (!rail.children.length) { return; }

        /* ── 마우스로 끌어서 스크롤 ── */
        var down = false, sx = 0, sl = 0, dragged = false;

        rail.classList.add('is-grab');

        rail.addEventListener('mousedown', function (e) {
            if (e.button !== 0) { return; }
            down = true; dragged = false;
            sx = e.clientX; sl = rail.scrollLeft;
            e.preventDefault();
        });

        window.addEventListener('mousemove', function (e) {
            if (!down) { return; }
            var dx = e.clientX - sx;
            if (!dragged && Math.abs(dx) > 5) { dragged = true; rail.classList.add('is-grabbing'); }
            if (dragged) { rail.scrollLeft = sl - dx; }
        });

        window.addEventListener('mouseup', function () {
            if (!down) { return; }
            down = false;
            rail.classList.remove('is-grabbing');
            /* 끌었다면 바로 뒤따라오는 클릭(사진 확대)을 한 번 막습니다 */
            if (dragged) {
                var kill = function (ev) { ev.stopPropagation(); ev.preventDefault(); };
                rail.addEventListener('click', kill, { capture: true, once: true });
                window.setTimeout(function () { rail.removeEventListener('click', kill, true); }, 0);
            }
        });

        /* ── 좌우 화살표 ── */
        var box = document.createElement('div');
        box.className = 'rail-box';
        rail.parentNode.insertBefore(box, rail);
        box.appendChild(rail);
        box.insertAdjacentHTML('beforeend',
            '<button class="rail-btn rail-prev" type="button" aria-label="이전으로">' +
                '<span class="ic ic-arrow" aria-hidden="true"></span></button>' +
            '<button class="rail-btn rail-next" type="button" aria-label="다음으로">' +
                '<span class="ic ic-arrow" aria-hidden="true"></span></button>');

        var prev = box.querySelector('.rail-prev');
        var next = box.querySelector('.rail-next');

        function step() {
            var first = rail.children[0];
            return first ? first.getBoundingClientRect().width + 14 : rail.clientWidth * .8;
        }
        function slide(dir) {
            rail.scrollBy({ left: dir * step(), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
        }
        function paint() {
            var max = rail.scrollWidth - rail.clientWidth;
            prev.disabled = rail.scrollLeft <= 2;
            next.disabled = rail.scrollLeft >= max - 2;
            var none = max <= 2;
            prev.style.visibility = none ? 'hidden' : '';
            next.style.visibility = none ? 'hidden' : '';
        }

        prev.addEventListener('click', function () { slide(-1); });
        next.addEventListener('click', function () { slide(1); });
        rail.addEventListener('scroll', paint, { passive: true });
        window.addEventListener('resize', paint);
        paint();
        window.setTimeout(paint, 300);   /* 사진이 로드된 뒤 다시 계산 */
    });


    /* ================================================================
       5. 전화 · 메시지 상담 — 영업점 선택 시트
          데스크톱에서는 전화 걸기가 안 되므로 안내 문구를 띄우고,
          번호를 눌러 복사할 수 있게 합니다.
       ================================================================ */

    var sheet, sheetBack, sheetT, sheetD, sheetList, sheetLast = null;

    function buildSheet() {
        sheetBack = document.createElement('div');
        sheetBack.className = 'sheet-back';
        document.body.appendChild(sheetBack);

        sheet = document.createElement('div');
        sheet.className = 'sheet';
        sheet.setAttribute('role', 'dialog');
        sheet.setAttribute('aria-modal', 'true');
        sheet.innerHTML =
            '<div class="sheet-grip" aria-hidden="true"></div>' +
            '<p class="sheet-t"></p>' +
            '<p class="sheet-d"></p>' +
            '<div class="sheet-note">' +
                '<span class="ic ic-phone" aria-hidden="true"></span>' +
                '<span>모바일에서만 바로 연결됩니다. 번호를 누르면 복사됩니다.</span>' +
            '</div>' +
            '<div class="branch"></div>';
        document.body.appendChild(sheet);

        sheetT = sheet.querySelector('.sheet-t');
        sheetD = sheet.querySelector('.sheet-d');
        sheetList = sheet.querySelector('.branch');
        /* 배경을 눌러 닫기.
           손가락이 배경에서 "눌리기 시작"한 경우에만 닫습니다.
           버튼을 눌러 시트가 열리는 순간 그 탭이 배경으로 이어지는(고스트 클릭)
           상황에서는 눌린 시작점이 배경이 아니므로 닫히지 않습니다. */
        var downOnBack = false;
        sheetBack.addEventListener('pointerdown', function (e) {
            downOnBack = (e.target === sheetBack);
        });
        sheetBack.addEventListener('click', function (e) {
            if (e.target !== sheetBack) { return; }
            if (!downOnBack) { downOnBack = false; return; }
            downOnBack = false;
            closeSheet();
        });
        sheet.setAttribute('aria-labelledby', '');
    }

    function openSheet(mode) {
        if (typeof BRANCHES === 'undefined' || !BRANCHES.length) { return; }
        if (!sheet) { buildSheet(); }

        var sms = mode === 'sms', kakao = mode === 'kakao', pick = mode === 'send';
        sheetT.textContent = pick  ? '어떻게 보낼까요?'
                           : kakao ? '카카오톡으로 문의할 영업점을 선택해 주세요'
                           : sms   ? '문의하실 영업점을 선택해 주세요'
                                   : '상담하실 영업점을 선택해 주세요';
        sheetD.textContent = pick
            ? '견적서를 복사한 뒤 보낼 방법을 골라 주세요.'
            : kakao
            ? '카카오톡으로 바로 연결됩니다. 아직 열리지 않은 영업점은 메시지로 문의해 주세요.'
            : sms
            ? '운행 중 통화가 어려울 수 있습니다. 메시지를 남겨주시면 확인 후 안내드립니다.'
            : '24시간 연중무휴로 상담을 운영합니다. 가까운 영업점을 선택해 주세요.';

        if (pick) {
            sheetList.innerHTML =
                '<button class="branch-item is-main" type="button" data-pick="sms">' +
                    '<span class="branch-b">' +
                        '<span class="branch-n">메시지</span>' +
                        '<span class="branch-tel">메시지로 보내기</span>' +
                    '</span><span class="ic ic-arrow" aria-hidden="true"></span></button>' +
                '<button class="branch-item" type="button" data-pick="kakao">' +
                    '<span class="branch-b">' +
                        '<span class="branch-n">카카오톡</span>' +
                        '<span class="branch-tel">카카오톡으로 보내기</span>' +
                    '</span><span class="ic ic-arrow" aria-hidden="true"></span></button>';
            all('[data-pick]', sheetList).forEach(function (b) {
                b.addEventListener('click', function (e) { e.stopPropagation(); openSheet(b.getAttribute('data-pick')); });
            });
            sheetBack.classList.add('is-on');
            sheet.classList.add('is-on');
            document.body.classList.add('lb-open');
            sheetList.querySelector('.branch-item').focus();
            document.addEventListener('keydown', onSheetKey);
            return;
        }

        /* 카카오톡은 채팅방을 운영하는 영업점만 보여 줍니다.
           site.js 에 kakao 줄이 없는 영업점은 목록에서 빠집니다. */
        var pool = kakao
            ? BRANCHES.filter(function (b) { return typeof b.kakao === 'string'; })
            : BRANCHES;

        sheetList.innerHTML = pool.map(function (b) {
            if (kakao) {
                var inner2 =
                    '<span class="branch-b">' +
                        '<span class="branch-n">' + esc(b.name) +
                            (b.main ? '<span class="pill">대표</span>' : '') + '</span>' +
                        '<span class="branch-tel">' + (b.kakao ? '카카오톡 열기' : '준비 중') + '</span>' +
                    '</span>' +
                    (b.kakao ? '<span class="ic ic-arrow" aria-hidden="true"></span>' : '');
                return b.kakao
                    ? '<a class="branch-item" href="' + esc(b.kakao) + '" target="_blank" rel="noopener">' + inner2 + '</a>'
                    : '<div class="branch-item is-off">' + inner2 + '</div>';
            }

            var href = (sms ? 'sms:' : 'tel:') + telDigits(b.tel);
            var inner =
                '<span class="branch-b">' +
                    '<span class="branch-n">' + esc(b.name) +
                        (b.main ? '<span class="pill">대표</span>' : '') + '</span>' +
                    '<span class="branch-tel">' + esc(b.tel) + '</span>' +
                '</span>' +
                '<span class="ic ic-arrow" aria-hidden="true"></span>';

            /* 모바일이면 바로 연결, 데스크톱이면 번호를 복사해 줍니다 */
            return isMobile
                ? '<a class="branch-item' + (b.main ? ' is-main' : '') + '" href="' + href + '">' + inner + '</a>'
                : '<button class="branch-item' + (b.main ? ' is-main' : '') + '" type="button" ' +
                       'data-copy="' + esc(b.tel) + '">' + inner + '</button>';
        }).join('');

        /* 데스크톱 — 누르면 번호를 복사해 줍니다 */
        all('[data-copy]', sheetList).forEach(function (btn) {
            btn.addEventListener('click', function () {
                var tel = btn.getAttribute('data-copy');
                var label = btn.querySelector('.branch-tel');
                copyText(tel, function (ok) {
                    var old = label.textContent;
                    label.textContent = ok ? '복사했습니다 · ' + old : old;
                    window.setTimeout(function () { label.textContent = old; }, 1800);
                });
            });
        });

        sheet.querySelector('.sheet-note').style.display = (kakao || pick) ? 'none' : '';
        sheetLast = document.activeElement;
        sheetBack.classList.add('is-on');
        sheet.classList.add('is-on');
        document.body.classList.add('lb-open');
        var first = sheetList.querySelector('.branch-item');
        if (first) { first.focus(); }
        document.addEventListener('keydown', onSheetKey);
    }

    function closeSheet() {
        if (!sheet) { return; }
        sheetBack.classList.remove('is-on');
        sheet.classList.remove('is-on');
        document.body.classList.remove('lb-open');
        document.removeEventListener('keydown', onSheetKey);
        if (sheetLast && sheetLast.focus) { sheetLast.focus(); sheetLast = null; }
    }

    function onSheetKey(e) {
        if (e.key === 'Escape') { closeSheet(); return; }
        if (e.key !== 'Tab') { return; }
        var f = all('a, button', sheet).filter(function (b) { return b.offsetParent !== null; });
        if (!f.length) { return; }
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }

    all('[data-call]').forEach(function (b) {
        b.addEventListener('click', function (e) { e.stopPropagation(); openSheet('tel'); });
    });

    all('[data-sms]').forEach(function (b) {
        b.addEventListener('click', function (e) { e.stopPropagation(); openSheet('sms'); });
    });
    all('[data-kakao]').forEach(function (b) {
        b.addEventListener('click', function (e) { e.stopPropagation(); openSheet('kakao'); });
    });
    all('[data-send]').forEach(function (b) {
        b.addEventListener('click', function (e) { e.stopPropagation(); openSheet('send'); });
    });

    /* 남아 있는 메시지 링크 — 데스크톱에서는 시트를 대신 띄웁니다 */
    all('a[href^="sms:"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
            if (!isMobile) { e.preventDefault(); openSheet('sms'); }
        });
    });


    /* ================================================================
       6. 복사 도우미
       ================================================================ */

    function copyText(text, done) {
        function fallback() {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            ta.setSelectionRange(0, text.length);
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
            document.body.removeChild(ta);
            if (!ok) { window.prompt('아래 내용을 복사해 주세요', text); }
            done(ok);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
        } else { fallback(); }
    }


    /* ================================================================
       7. 카테고리 탭 — 지금 보고 있는 구간을 표시합니다
       ================================================================ */

    var tabBox = $('tabs');
    if (tabBox) {
        var tabs = all('.tab', tabBox).filter(function (t) {
            return (t.getAttribute('href') || '').charAt(0) === '#';
        });
        var targets = tabs.map(function (t) { return document.querySelector(t.getAttribute('href')); });

        function markTab(i) {
            tabs.forEach(function (t, k) { t.classList.toggle('is-on', k === i); });
            var el = tabs[i];
            if (el && tabBox.scrollWidth > tabBox.clientWidth) {
                var left = el.offsetLeft - (tabBox.clientWidth - el.offsetWidth) / 2;
                tabBox.scrollTo({ left: Math.max(0, left), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
            }
        }

        if ('IntersectionObserver' in window) {
            var seen = {};
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (e) { seen[e.target.id] = e.isIntersecting ? e.intersectionRatio : 0; });
                var best = -1, bestV = 0;
                targets.forEach(function (t, k) {
                    if (!t) { return; }
                    var v = seen[t.id] || 0;
                    if (v > bestV) { bestV = v; best = k; }
                });
                if (best >= 0) { markTab(best); }
            }, { rootMargin: '-45% 0px -45% 0px', threshold: [0, .25, .5, 1] });
            targets.forEach(function (t) { if (t) { io.observe(t); } });
        }
    }


    /* ================================================================
       8. 등장 애니메이션
       ================================================================ */

    var rises = all('.rise');
    if (rises.length) {
        if ('IntersectionObserver' in window) {
            var rio = new IntersectionObserver(function (entries) {
                entries.forEach(function (e) {
                    if (e.isIntersecting) { e.target.classList.add('is-on'); rio.unobserve(e.target); }
                });
            }, { threshold: .06, rootMargin: '0px 0px -40px 0px' });
            rises.forEach(function (el) { rio.observe(el); });
        } else {
            rises.forEach(function (el) { el.classList.add('is-on'); });
        }
    }


    /* ================================================================
       9. 네비게이션 — 헤더 안 패널을 접고 폅니다
          기본은 닫힌 상태입니다. 링크를 누르거나 ESC 를 누르면 닫힙니다.
       ================================================================ */

    var foldBtn = $('nav-fold');
    var navPanel = $('navpanel');

    if (foldBtn && navPanel) {

        function setNav(open) {
            document.body.classList.toggle('nav-open', open);
            foldBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
            foldBtn.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
        }

        foldBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            setNav(!document.body.classList.contains('nav-open'));
        });

        /* 메뉴를 고르면 닫습니다 */
        all('.tab', navPanel).forEach(function (t) {
            t.addEventListener('click', function () { setNav(false); });
        });

        /* 바깥을 누르거나 ESC 를 누르면 닫힙니다 */
        document.addEventListener('click', function (e) {
            if (!document.body.classList.contains('nav-open')) { return; }
            if (!navPanel.contains(e.target) && e.target !== foldBtn) { setNav(false); }
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && document.body.classList.contains('nav-open')) {
                setNav(false); foldBtn.focus();
            }
        });
    }


    /* ================================================================
       10. 훈련사 경력 더보기
       ================================================================ */

    var careerBtn = $('career-more');
    var careerBox = $('career');
    if (careerBtn && careerBox) {
        careerBtn.addEventListener('click', function () {
            var folded = careerBox.classList.toggle('is-folded');
            careerBtn.setAttribute('aria-expanded', folded ? 'false' : 'true');
            careerBtn.textContent = folded
                ? '경력 전체 보기 (' + careerBox.children.length + '건)'
                : '접기';
        });
    }

    /* 페이지 밖에서도 쓸 수 있게 열어 둡니다 (견적 페이지에서 사용) */
    window.PetTaxi = { copyText: copyText, esc: esc, pad2: pad2, clamp: clamp, isMobile: isMobile };
})();
