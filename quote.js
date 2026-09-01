/* ==================================================================
   개편한펫택시&피크닉 — 견적 요청서

   서버로 보내지 않습니다. 입력한 내용은 브라우저 안에서만 처리되고
   "복사" 또는 "다운로드" 를 눌렀을 때만 밖으로 나갑니다.
   ================================================================== */

(function () {
    'use strict';

    var qform = document.getElementById('qform');
    if (!qform) { return; }

    var U    = window.PetTaxi || {};
    var esc  = U.esc  || function (t) { return String(t); };
    var pad2 = U.pad2 || function (n) { return (n < 10 ? '0' : '') + n; };
    var clamp = U.clamp || function (v, a, b) { return Math.min(b, Math.max(a, v)); };
    var isMobile = typeof U.isMobile === 'boolean' ? U.isMobile
                 : /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
    var isAndroid = /Android/i.test(navigator.userAgent);

    function $(id) { return document.getElementById(id); }
    function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    function val(id) { var el = $(id); return el ? el.value.trim() : ''; }

    var counts  = { human: 1, dogS: 0, dogM: 0, dogL: 0, cat: 0 };
    var bag     = '없음';
    var isRound = false;


    /* ================================================================
       1. 처음 값 — 내일 오전 10시로 잡아 둡니다
       ================================================================ */

    function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

    var today    = new Date();
    var tomorrow = new Date(today.getTime() + 86400000);

    if ($('q-date')) { $('q-date').min = ymd(today); $('q-date').value = ymd(tomorrow); }
    if ($('q-time')) { $('q-time').value = '10:00'; }
    if ($('r-date')) { $('r-date').min = ymd(today); }


    /* ================================================================
       2. 글자 만들기
       ================================================================ */

    function joinAddr(base, detail) { return base ? (detail ? base + ' ' + detail : base) : ''; }

    function dateText(id) {
        var v = val(id);
        if (!v) { return ''; }
        var p = v.split('-');
        var d = new Date(+p[0], +p[1] - 1, +p[2]);
        var days = ['일', '월', '화', '수', '목', '금', '토'];
        return p[0] + '년 ' + (+p[1]) + '월 ' + (+p[2]) + '일 (' + days[d.getDay()] + ')';
    }

    function timeText(id) {
        var v = val(id);
        if (!v) { return ''; }
        var hh = parseInt(v.split(':')[0], 10), mm = v.split(':')[1];
        var ampm = hh < 12 ? '오전' : '오후';
        var h12 = hh % 12; if (h12 === 0) { h12 = 12; }
        return ampm + ' ' + h12 + '시' + (mm === '00' ? '' : ' ' + parseInt(mm, 10) + '분');
    }

    function petText() {
        var parts = [];
        if (counts.dogS) { parts.push('소형견 ' + counts.dogS + '마리'); }
        if (counts.dogM) { parts.push('중형견 ' + counts.dogM + '마리'); }
        if (counts.dogL) { parts.push('대형견 ' + counts.dogL + '마리'); }
        if (counts.cat)  { parts.push('고양이 ' + counts.cat + '마리'); }
        return parts.join(', ');
    }

    /* 요청서에 들어갈 줄 — ['head', 제목] 은 소제목, [라벨, 값] 은 내용입니다 */
    function rows() {
        var r = [];

        r.push(['head', isRound ? '가는 길' : '이동 정보']);
        r.push(['이용 날짜', dateText('q-date')]);
        r.push(['출발 시간', timeText('q-time')]);
        r.push(['출발지',   joinAddr(val('q-from'), val('q-from-detail'))]);
        r.push(['도착지',   joinAddr(val('q-to'),   val('q-to-detail'))]);

        if (isRound) {
            r.push(['head', '오는 길 (왕복)']);
            r.push(['복귀 날짜',   dateText('r-date')]);
            r.push(['픽업 시간',   timeText('r-time')]);
            r.push(['복귀 출발지', joinAddr(val('r-from'), val('r-from-detail'))]);
            r.push(['복귀 도착지', joinAddr(val('r-to'),   val('r-to-detail'))]);
            if (val('r-note')) { r.push(['복귀 요청사항', val('r-note')]); }
        }

        r.push(['head', '탑승 정보']);
        r.push(['이용 방식',  isRound ? '왕복' : '편도']);
        r.push(['탑승 인원',  counts.human ? '보호자 ' + counts.human + '명' : '보호자 동승 없음']);
        r.push(['반려동물',   petText()]);
        r.push(['짐',        bag]);
        r.push(['요청사항',   val('q-note')]);
        return r;
    }


    /* ================================================================
       3. 미리보기
       ================================================================ */

    var quoteList = $('quote-list');

    /* 미리보기 화면을 두지 않습니다. 복사·다운로드할 때 그 자리에서 만듭니다. */
    function render() {}

    /* 메시지에 붙여넣기 좋은 형태.

       공백 하나가 주소에서는 3자(%20)가 되고 한글은 9자가 됩니다.
       안드로이드 메시지 앱은 긴 본문을 잘라내는 경우가 있어
       들여쓰기와 빈 줄을 두지 않고 되도록 짧게 만듭니다. */
    function plainText() {
        var lines = ['[개편한펫택시&피크닉 견적 요청]'];
        rows().forEach(function (r) {
            if (r[0] === 'head') { lines.push('▶ ' + r[1]); }
            else if (r[1])       { lines.push(r[0] + ': ' + r[1]); }
        });
        return lines.join('\n');
    }


    /* ================================================================
       4. 왕복 — 켜면 돌아오는 길 정보를 받습니다
       ================================================================ */

    var tripChk = $('q-trip');
    var tripBox = $('q-trip-box');
    var retBox  = $('q-return');

    /* 가는 길의 도착지 ↔ 출발지를 복귀 쪽에 뒤집어 넣습니다 */
    function fillReverse(force) {
        var pairs = [
            ['q-to',   'r-from'], ['q-to-detail',   'r-from-detail'],
            ['q-from', 'r-to'],   ['q-from-detail', 'r-to-detail']
        ];
        pairs.forEach(function (p) {
            var src = $(p[0]), dst = $(p[1]);
            if (!src || !dst) { return; }
            if (force || !dst.value) { dst.value = src.value; }
        });
        /* 복귀 날짜가 비어 있으면 같은 날로 잡아 둡니다 */
        if ($('r-date') && (force || !$('r-date').value)) { $('r-date').value = val('q-date'); }
        if ($('r-time') && (force || !$('r-time').value)) { $('r-time').value = '16:00'; }
        render();
    }

    if (tripChk) {
        tripChk.addEventListener('change', function () {
            isRound = tripChk.checked;
            tripBox.classList.toggle('is-on', isRound);
            retBox.classList.toggle('is-on', isRound);
            if (isRound) {
                fillReverse(false);
                if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                    window.setTimeout(function () {
                        retBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 80);
                }
            }
            render();
        });
    }




    /* ================================================================
       5. 수량 · 짐
       ================================================================ */

    all('.qty', qform).forEach(function (box) {
        var key = box.getAttribute('data-key');
        var out = box.querySelector('.qty-v');
        all('.qty-btn', box).forEach(function (btn) {
            btn.addEventListener('click', function () {
                counts[key] = clamp(counts[key] + parseInt(btn.getAttribute('data-step'), 10), 0, 20);
                out.textContent = counts[key];
                box.classList.toggle('is-set', counts[key] > 0);
                render(); restoreActions();
            });
        });
        box.classList.toggle('is-set', counts[key] > 0);
    });

    all('#q-bag .chip').forEach(function (chip) {
        chip.addEventListener('click', function () {
            bag = chip.getAttribute('data-val');
            all('#q-bag .chip').forEach(function (c) {
                var on = c === chip;
                c.classList.toggle('is-on', on);
                c.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            render(); restoreActions();
        });
    });


    /* ================================================================
       6. 주소 검색 (다음 우편번호 서비스)
          스크립트를 못 불러오는 환경에서는 직접 입력으로 자동 전환됩니다.
       ================================================================ */

    /* 주소 검색 창을 페이지 안에 띄웁니다.
       별도 팝업 창으로 열면 브라우저가 막거나 선택 결과가 되돌아오지 않는 일이
       있어서, 화면 안 레이어에 심는 방식(embed)을 씁니다. */

    var addrBack, addrBox, addrTitle, addrLast = null;

    function buildAddr() {
        addrBack = document.createElement('div');
        addrBack.className = 'addr-back';
        addrBack.innerHTML =
            '<div class="addr-modal" role="dialog" aria-modal="true" aria-label="주소 검색">' +
                '<div class="addr-hd">' +
                    '<p class="addr-t"></p>' +
                    '<button class="addr-x" type="button" aria-label="주소 검색 닫기">' +
                        '<span class="ic ic-close" aria-hidden="true"></span></button>' +
                '</div>' +
                '<div class="addr-box"></div>' +
            '</div>';
        document.body.appendChild(addrBack);
        addrBox   = addrBack.querySelector('.addr-box');
        addrTitle = addrBack.querySelector('.addr-t');
        addrBack.querySelector('.addr-x').addEventListener('click', closeAddr);
        addrBack.addEventListener('click', function (e) { if (e.target === addrBack) { closeAddr(); } });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && addrBack.classList.contains('is-on')) { closeAddr(); }
        });
    }

    function closeAddr() {
        if (!addrBack) { return; }
        addrBack.classList.remove('is-on');
        document.body.classList.remove('lb-open');
        addrBox.innerHTML = '';
        if (addrLast && addrLast.focus) { addrLast.focus(); addrLast = null; }
    }

    function openAddr(field, label) {
        if (!addrBack) { buildAddr(); }
        addrLast = document.activeElement;
        addrTitle.textContent = label + ' 주소 검색';
        addrBox.innerHTML = '';
        addrBack.classList.add('is-on');
        document.body.classList.add('lb-open');

        new window.daum.Postcode({
            oncomplete: function (data) {
                field.value = data.roadAddress || data.jibunAddress;
                closeAddr();
                var detail = $(field.id + '-detail');
                if (detail) { detail.focus(); }
                if (isRound) { fillReverse(false); }
                render();
            },
            onclose: function () { closeAddr(); },
            width: '100%',
            height: '100%'
        }).embed(addrBox, { autoClose: false });
    }

    all('.qsearch').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var field = $(btn.getAttribute('data-addr'));
            if (!field) { return; }

            /* 검색 도구를 못 불러오면 직접 입력할 수 있게 풀어 줍니다 */
            if (typeof window.daum === 'undefined' || !window.daum.Postcode) {
                field.readOnly = false;
                field.placeholder = '주소를 직접 입력해 주세요';
                field.focus();
                return;
            }
            var lbl = btn.closest('.qfield');
            lbl = lbl ? (lbl.querySelector('.qlabel') || {}).textContent : '';
            openAddr(field, (lbl || '').trim());
        });
    });

    all('input, textarea', qform).forEach(function (el) {
        el.addEventListener('input',  function () { render(); restoreActions(); });
        el.addEventListener('change', function () { render(); restoreActions(); });
    });


    /* ================================================================
       7. 내보내기 — 복사 / PDF 저장
       ================================================================ */

    /* ================================================================
       7-1. 견적서 보내기 — 복사·다운로드를 마치면 나타납니다
            문의하실 영업점을 골라 접수합니다.
       ================================================================ */

    var sendBox = $('sendbox'), sendDrawn = false;

    function drawSendBox() {
        if (sendDrawn || !sendBox || typeof BRANCHES === 'undefined') { return; }

        function item(label, value, href, off) {
            var inner =
                '<span class="senditem-b">' +
                    '<span class="senditem-n">' + esc(label) + '</span>' +
                    '<span class="senditem-v">' + esc(value) +
                        (off ? ' <span class="pill">준비 중</span>' : '') + '</span>' +
                '</span>' +
                (off ? '' : '<span class="ic ic-arrow" aria-hidden="true"></span>');
            return off
                ? '<div class="senditem is-off">' + inner + '</div>'
                : '<a class="senditem" href="' + esc(href) + '"' +
                  (href.indexOf('http') === 0 ? ' target="_blank" rel="noopener"' : '') + '>' + inner + '</a>';
        }

        function group(id, icon, title, inner) {
            return '<div class="sendgroup" data-g="' + id + '">' +
                '<button class="sendhead" type="button" aria-expanded="false">' +
                    '<span class="ic ic-lead ' + icon + '" aria-hidden="true"></span>' +
                    '<span class="sh-t">' + title + '</span>' +
                    '<span class="ic ic-chev" aria-hidden="true"></span>' +
                '</button>' +
                '<div class="sendlist" hidden>' + inner + '</div>' +
            '</div>';
        }

        /* 누를 때 본문을 만들어 붙입니다. href 는 본문 없는 형태로 남겨 두어
           자바스크립트가 막힌 환경에서도 번호는 뜨게 합니다. */
        var sms = BRANCHES.map(function (b) {
            var tel = String(b.tel).replace(/[^0-9]/g, '');
            return item(b.name, b.tel, 'sms:' + tel, false)
                .replace('<a class="senditem"',
                         '<a class="senditem" data-smstel="' + tel + '" data-teldisp="' + esc(b.tel) + '"');
        }).join('');
        sendBox.innerHTML =
            '<p class="sendbox-t"><span class="ic ic-doc" aria-hidden="true"></span>견적서 보내기</p>' +
            '<p class="sendbox-d">접수처를 고르면 <b>메시지에 견적서가 채워집니다.</b></p>' +
            group('sms', 'ic-sms', '메시지로 접수', sms);

        /* 한 번에 하나만 펼칩니다 */
        all('.sendhead', sendBox).forEach(function (h) {
            h.addEventListener('click', function () {
                var g = h.parentElement, open = !g.classList.contains('is-open');
                all('.sendgroup', sendBox).forEach(function (o) {
                    o.classList.remove('is-open');
                    o.querySelector('.sendlist').hidden = true;
                    o.querySelector('.sendhead').setAttribute('aria-expanded', 'false');
                });
                if (open) {
                    g.classList.add('is-open');
                    g.querySelector('.sendlist').hidden = false;
                    h.setAttribute('aria-expanded', 'true');
                }
            });
        });
        /* 메시지 항목 — 누르는 순간의 입력 내용으로 본문을 만들어 넣습니다 */
        all('[data-smstel]', sendBox).forEach(function (a) {
            a.addEventListener('click', function (e) {
                e.preventDefault();

                var text = plainText();
                var tel  = a.getAttribute('data-smstel');

                /* PC 에는 문자 앱이 없어 sms: 를 열어도 아무 일이 일어나지 않습니다.
                   그래서 견적서를 복사해 주고 번호를 안내합니다. */
                if (!isMobile) {
                    if (U.copyText) {
                        U.copyText(text, function (ok) {
                            note(ok
                                ? '견적서를 복사했습니다. 휴대폰 문자로 ' + a.getAttribute('data-teldisp') +
                                  ' 번호에 붙여넣어 보내주세요.'
                                : '휴대폰에서 ' + a.getAttribute('data-teldisp') + ' 번호로 보내주세요.');
                        });
                    } else {
                        note('휴대폰에서 ' + a.getAttribute('data-teldisp') + ' 번호로 보내주세요.');
                    }
                    return;
                }

                /* 내용이 아주 길면 앱이 잘라낼 수 있어 원문을 복사해 둡니다 */
                var url = smsUrl(tel, text);
                if (url.length > SMS_SAFE_LEN && U.copyText) {
                    U.copyText(text, function () {});
                    note('내용이 길어 문자에 다 담기지 않을 수 있습니다. 잘렸다면 입력창을 길게 눌러 붙여넣기 해주세요.');
                }
                window.location.href = url;
            });
        });

        sendDrawn = true;
    }

    /* 접수 목록 아래에 잠깐 뜨는 안내 */
    function note(msg) {
        if (!sendBox) { return; }
        var el = sendBox.querySelector('.sendnote');
        if (!el) {
            el = document.createElement('p');
            el.className = 'sendnote';
            el.setAttribute('role', 'status');
            sendBox.appendChild(el);
        }
        el.textContent = msg;
    }

    /* ----------------------------------------------------------------
       메시지 주소 만들기

       sms: 는 브라우저가 아니라 기기의 메시지 앱이 처리하는 주소입니다.
       body= 에 넣은 글이 메시지 입력창에 미리 채워집니다.
       iOS 는 'sms:번호?&body=', 안드로이드는 'sms:번호?body=' 로 받습니다.

       한글은 인코딩하면 글자당 9자로 늘어납니다. 요청사항까지 길게 쓰면
       주소가 3천 자를 넘어 일부 기기에서 잘릴 수 있어, 그럴 때는
       클립보드에 원문을 넣어 두고 붙여넣기로 안내합니다.
       ---------------------------------------------------------------- */

    var SMS_SAFE_LEN = 2500;

    /* 안드로이드 일부 브라우저는 메시지 앱에 넘기기 전에 주소를 한 번 더 풀어 냅니다.
       그러면 본문 안의 %26 이 & 로 되돌아가고, 메시지 앱이 그것을 파라미터
       구분자로 읽어 그 앞까지만 남깁니다. (상호의 '&' 때문에 잘리던 원인)
       구분자로 오해받는 글자는 생김새가 같은 전각 문자로 바꿔 보냅니다. */
    function safeBody(text) {
        return String(text)
            .replace(/&/g, '＆')      /* U+FF06 — 파라미터 구분자로 읽히지 않습니다 */
            .replace(/#/g, '＃');     /* U+FF03 — 조각(fragment) 구분자 방지 */
    }

    function smsUrl(tel, text) {
        var ios = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
        return 'sms:' + tel + '?' + (ios ? '&' : '') + 'body=' + encodeURIComponent(safeBody(text));
    }

    var sendBtn = $('q-send');

    /* 내용을 고치면 이전 안내는 지웁니다. 메시지 본문은 누를 때 다시 만들어
       항상 최신 입력이 들어가므로 따로 되돌릴 것은 없습니다. */
    function restoreActions() {
        var el = sendBox && sendBox.querySelector('.sendnote');
        if (el && el.parentNode) { el.parentNode.removeChild(el); }
    }

    function showSendBox() {
        if (!sendBox) { return; }
        drawSendBox();
        if (!sendBox.hidden) { return; }
        sendBox.hidden = false;
        document.body.classList.add('is-sent');
        var first = sendBox.querySelector('.sendgroup');
        if (first && !first.classList.contains('is-open')) { first.querySelector('.sendhead').click(); }
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            window.setTimeout(function () {
                sendBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 120);
        }
    }


    /* 보내기 — 원문을 클립보드에 넣어 두고 접수처 목록을 폅니다.
       메시지 앱이 본문을 못 받는 경우에도 바로 붙여넣을 수 있습니다. */
    if (sendBtn) {
        sendBtn.addEventListener('click', function () {
            if (U.copyText) { U.copyText(plainText(), function () {}); }
            showSendBox();
        });
    }

    var pdfBtn = $('q-pdf');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', function () {
            var body = $('sheet-body');
            var made = $('sheet-made');

            if (body) {
                body.innerHTML = rows().map(function (r) {
                    if (r[0] === 'head') {
                        return '<tr class="grp"><th colspan="2">' + esc(r[1]) + '</th></tr>';
                    }
                    return '<tr><th>' + esc(r[0]) + '</th><td>' + (r[1] ? esc(r[1]) : '-') + '</td></tr>';
                }).join('');
            }
            if (made) {
                var n = new Date();
                made.textContent = '작성일 ' + n.getFullYear() + '. ' + pad2(n.getMonth() + 1) + '. ' + pad2(n.getDate());
            }
            /* 저장되는 파일 이름이 되므로 잠시 문서 제목을 바꿉니다 */
            var title = document.title;
            document.title = '개편한펫택시_견적요청서_' + (val('q-date') || '').replace(/-/g, '');
            window.print();
            window.setTimeout(function () { document.title = title; }, 600);
            showSendBox();
        });
    }

    render();
})();
