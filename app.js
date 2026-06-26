/* ===================================================================
 * 紫微斗数排盘网页应用  (基于 iztro 引擎)
 * 文墨天机风格盘面 + 文字解读 + 盘面导图
 * =================================================================== */

(function () {
  'use strict';

  // ---------- 主星性质速记表 ----------
  const STAR_TRAITS = {
    '紫微': '帝王之星，主领导、尊贵、好面子，有统御之气与组织才能',
    '天机': '智慧之星，主谋略、机敏、善变，长于策划与思考',
    '太阳': '光明之星，主博爱、付出、热情，代表事业与男性长辈',
    '武曲': '财星，主刚毅、果决、行动力强，擅长实务与理财',
    '天同': '福星，主温和、随和、懂享受，情绪柔软带稚气',
    '廉贞': '次桃花兼囚星，主多变、感性、政治手腕，刚柔并济',
    '天府': '财库之星，主稳重、包容、保守，善守成与积累',
    '太阴': '财星，主柔和、内敛、细腻，代表母亲与女性长辈',
    '贪狼': '桃花之星，主欲望、多才多艺、善交际，活力充沛',
    '巨门': '暗星，主口才、研究、是非，长于专业与口舌生财',
    '天相': '印星，主辅佐、慈善、重衣食，讲求体面与协调',
    '天梁': '荫星，主庇护、长者风范、清高，有化解灾厄之能',
    '七杀': '将星，主肃杀、冲劲、独立，开创力强而不畏挑战',
    '破军': '耗星，主开创、变动、先破后立，富冲劲与革新精神',
  };

  const PALACE_MEANING = {
    '命宫': '核心性格、天赋与人生格局总纲',
    '兄弟': '兄弟姐妹、平辈与合作关系',
    '夫妻': '婚姻、配偶与亲密关系',
    '子女': '子女、晚辈、创造力与桃花',
    '财帛': '财富、理财与收入方式',
    '疾厄': '健康、体质与情绪状态',
    '迁移': '外出、社交与环境际遇',
    '仆役': '朋友、下属与人际网络',
    '交友': '朋友、下属与人际网络',
    '官禄': '事业、职业与社会成就',
    '田宅': '不动产、家庭与居住环境',
    '福德': '精神享受、福分与兴趣',
    '父母': '父母、长辈、上司与文书',
  };

  const MUT_MEANING = {
    '禄': '主财禄、顺遂、增益与缘分',
    '权': '主权力、掌控、能力与强势',
    '科': '主名声、贵人、文书与化解',
    '忌': '主阻碍、执着、亏欠，最需留意经营',
  };

  // 地支 -> 4x4 网格位置 [row, col]
  const GRID_POS = {
    '巳': [0, 0], '午': [0, 1], '未': [0, 2], '申': [0, 3],
    '辰': [1, 0],                              '酉': [1, 3],
    '卯': [2, 0],                              '戌': [2, 3],
    '寅': [3, 0], '丑': [3, 1], '子': [3, 2], '亥': [3, 3],
  };

  // ---------- 埋点（容错包装，tracker.js 缺失也不报错） ----------
  function trk(name, props) {
    try { if (window.ZT && ZT.track) ZT.track(name, props || {}); } catch (e) {}
  }
  function yb(y) { try { return (window.ZT && ZT.yearBucket) ? ZT.yearBucket(y) : ''; } catch (e) { return ''; } }

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const state = {
    gender: '男', cal: 'solar', leap: 'no', astro: null, data: null,
    dpScale: '3', dpQuestions: [], dpAnswers: {},
    dpScore: null,                       // 最近一次定盘契合分
    dpDetail: null,                      // 最近一次定盘四维分项明细
    tst: { used: false },                // 真太阳时换算详情
    jiepan: { unlocked: false, html: '' }, // 解盘解锁状态与已生成内容
  };
  const JIEPAN_PASS = 70;                 // 解盘解锁所需契合分

  // 24 小时制 -> 时辰下标（0 早子 … 11 亥 12 晚子）
  function hourToTimeIndex(h) {
    if (h === 23) return 12;       // 晚子时 23:00–23:59
    if (h === 0) return 0;         // 早子时 00:00–00:59
    return Math.floor((h + 1) / 2); // 丑1 寅2 … 亥11
  }

  // ===== 真太阳时校正 =====
  // 常见城市经度（东经，单位 度）。出生地在紫微斗数不参与起盘，
  // 仅用于把「钟表时间(北京时间, 东经120°基准)」折算为「当地真太阳时」，
  // 从而在时辰交界附近反推出更准确的时辰。
  const CITY_LNG = {
    // 直辖市
    '北京': 116.41, '上海': 121.47, '天津': 117.20, '重庆': 106.55,
    // 河北
    '石家庄': 114.51, '唐山': 118.18, '秦皇岛': 119.60, '邯郸': 114.49,
    '邢台': 114.51, '保定': 115.46, '张家口': 114.89, '承德': 117.96,
    '沧州': 116.84, '廊坊': 116.70, '衡水': 115.67,
    // 山西
    '太原': 112.55, '大同': 113.30, '阳泉': 113.58, '长治': 113.12,
    '晋城': 112.85, '朔州': 112.43, '晋中': 112.75, '运城': 111.00,
    '忻州': 112.73, '临汾': 111.52, '吕梁': 111.13,
    // 内蒙古
    '呼和浩特': 111.75, '包头': 109.84, '乌海': 106.79, '赤峰': 118.89,
    '通辽': 122.24, '鄂尔多斯': 109.78, '呼伦贝尔': 119.77, '巴彦淖尔': 107.39,
    '乌兰察布': 113.13, '兴安盟': 122.07, '锡林郭勒': 116.07, '阿拉善': 105.73,
    // 辽宁
    '沈阳': 123.43, '大连': 121.62, '鞍山': 122.99, '抚顺': 123.96,
    '本溪': 123.77, '丹东': 124.38, '锦州': 121.13, '营口': 122.24,
    '阜新': 121.67, '辽阳': 123.18, '盘锦': 122.07, '铁岭': 123.84,
    '朝阳': 120.45, '葫芦岛': 120.86,
    // 吉林
    '长春': 125.32, '吉林': 126.55, '四平': 124.35, '辽源': 125.14,
    '通化': 125.94, '白山': 126.42, '松原': 124.82, '白城': 122.84,
    '延边': 129.51,
    // 黑龙江
    '哈尔滨': 126.53, '齐齐哈尔': 123.92, '鸡西': 130.97, '鹤岗': 130.27,
    '双鸭山': 131.16, '大庆': 125.11, '伊春': 128.84, '佳木斯': 130.32,
    '七台河': 131.00, '牡丹江': 129.63, '黑河': 127.50, '绥化': 126.99,
    '大兴安岭': 124.71,
    // 江苏
    '南京': 118.80, '无锡': 120.30, '徐州': 117.18, '常州': 119.97,
    '苏州': 120.62, '南通': 120.86, '连云港': 119.16, '淮安': 119.02,
    '盐城': 120.16, '扬州': 119.41, '镇江': 119.45, '泰州': 119.92,
    '宿迁': 118.28,
    // 浙江
    '杭州': 120.16, '宁波': 121.55, '温州': 120.70, '嘉兴': 120.76,
    '湖州': 120.09, '绍兴': 120.58, '金华': 119.65, '衢州': 118.87,
    '舟山': 122.21, '台州': 121.43, '丽水': 119.92,
    // 安徽
    '合肥': 117.23, '芜湖': 118.38, '蚌埠': 117.39, '淮南': 117.02,
    '马鞍山': 118.51, '淮北': 116.80, '铜陵': 117.82, '安庆': 117.05,
    '黄山': 118.34, '滁州': 118.32, '阜阳': 115.81, '宿州': 116.98,
    '六安': 116.51, '亳州': 115.78, '池州': 117.49, '宣城': 118.76,
    // 福建
    '福州': 119.30, '厦门': 118.09, '莆田': 119.01, '三明': 117.64,
    '泉州': 118.68, '漳州': 117.65, '南平': 118.18, '龙岩': 117.02,
    '宁德': 119.55,
    // 江西
    '南昌': 115.86, '景德镇': 117.18, '萍乡': 113.85, '九江': 116.00,
    '新余': 114.92, '鹰潭': 117.07, '赣州': 114.94, '吉安': 114.99,
    '宜春': 114.39, '抚州': 116.36, '上饶': 117.97,
    // 山东
    '济南': 117.00, '青岛': 120.38, '淄博': 118.05, '枣庄': 117.32,
    '东营': 118.67, '烟台': 121.39, '潍坊': 119.16, '济宁': 116.59,
    '泰安': 117.13, '威海': 122.12, '日照': 119.53, '临沂': 118.36,
    '德州': 116.36, '聊城': 115.98, '滨州': 118.02, '菏泽': 115.48,
    // 河南
    '郑州': 113.62, '开封': 114.31, '洛阳': 112.45, '平顶山': 113.19,
    '安阳': 114.39, '鹤壁': 114.30, '新乡': 113.93, '焦作': 113.24,
    '濮阳': 115.04, '许昌': 113.85, '漯河': 114.02, '三门峡': 111.20,
    '南阳': 112.53, '商丘': 115.65, '信阳': 114.09, '周口': 114.65,
    '驻马店': 114.02,
    // 湖北
    '武汉': 114.30, '黄石': 115.04, '十堰': 110.79, '宜昌': 111.29,
    '襄阳': 112.14, '鄂州': 114.89, '荆门': 112.20, '孝感': 113.92,
    '荆州': 112.24, '黄冈': 114.87, '咸宁': 114.32, '随州': 113.37,
    '恩施': 109.49,
    // 湖南
    '长沙': 112.94, '株洲': 113.13, '湘潭': 112.94, '衡阳': 112.57,
    '邵阳': 111.47, '岳阳': 113.13, '常德': 111.69, '张家界': 110.48,
    '益阳': 112.36, '郴州': 113.02, '永州': 111.61, '怀化': 110.00,
    '娄底': 112.00, '湘西': 109.74,
    // 广东
    '广州': 113.26, '深圳': 114.06, '珠海': 113.55, '汕头': 116.68,
    '佛山': 113.12, '韶关': 113.60, '湛江': 110.36, '肇庆': 112.47,
    '江门': 113.08, '茂名': 110.93, '惠州': 114.42, '梅州': 116.12,
    '汕尾': 115.38, '河源': 114.70, '阳江': 111.98, '清远': 113.05,
    '东莞': 113.75, '中山': 113.39, '潮州': 116.62, '揭阳': 116.37,
    '云浮': 112.04,
    // 广西
    '南宁': 108.32, '柳州': 109.42, '桂林': 110.29, '梧州': 111.27,
    '北海': 109.12, '防城港': 108.35, '钦州': 108.62, '贵港': 109.60,
    '玉林': 110.16, '百色': 106.62, '贺州': 111.55, '河池': 108.06,
    '来宾': 109.23, '崇左': 107.36,
    // 海南
    '海口': 110.20, '三亚': 109.51, '三沙': 112.34, '儋州': 109.58,
    // 四川
    '成都': 104.07, '自贡': 104.78, '攀枝花': 101.72, '泸州': 105.44,
    '德阳': 104.40, '绵阳': 104.74, '广元': 105.84, '遂宁': 105.57,
    '内江': 105.06, '乐山': 103.76, '南充': 106.08, '眉山': 103.85,
    '宜宾': 104.64, '广安': 106.63, '达州': 107.50, '雅安': 103.04,
    '巴中': 106.75, '资阳': 104.64, '阿坝': 102.22, '甘孜': 101.96,
    '凉山': 102.27,
    // 贵州
    '贵阳': 106.71, '六盘水': 104.83, '遵义': 106.93, '安顺': 105.93,
    '毕节': 105.29, '铜仁': 109.19, '黔西南': 104.90, '黔东南': 107.98,
    '黔南': 107.52,
    // 云南
    '昆明': 102.83, '曲靖': 103.80, '玉溪': 102.55, '保山': 99.17,
    '昭通': 103.72, '丽江': 100.23, '普洱': 100.97, '临沧': 100.09,
    '楚雄': 101.55, '红河': 103.38, '文山': 104.24, '西双版纳': 100.80,
    '大理': 100.27, '德宏': 98.58, '怒江': 98.85, '迪庆': 99.71,
    // 西藏
    '拉萨': 91.14, '日喀则': 88.88, '昌都': 97.18, '林芝': 94.36,
    '山南': 91.77, '那曲': 92.06, '阿里': 80.11,
    // 陕西
    '西安': 108.94, '铜川': 108.95, '宝鸡': 107.14, '咸阳': 108.71,
    '渭南': 109.50, '延安': 109.49, '汉中': 107.02, '榆林': 109.74,
    '安康': 109.03, '商洛': 109.94,
    // 甘肃
    '兰州': 103.83, '嘉峪关': 98.29, '金昌': 102.19, '白银': 104.14,
    '天水': 105.72, '武威': 102.64, '张掖': 100.46, '平凉': 106.66,
    '酒泉': 98.51, '庆阳': 107.64, '定西': 104.62, '陇南': 104.93,
    '临夏': 103.21, '甘南': 102.91,
    // 青海
    '西宁': 101.78, '海东': 102.10, '海北': 100.90, '黄南': 102.02,
    '海南州': 100.62, '果洛': 100.24, '玉树': 97.01, '海西': 97.37,
    // 宁夏
    '银川': 106.23, '石嘴山': 106.38, '吴忠': 106.20, '固原': 106.24, '中卫': 105.19,
    // 新疆
    '乌鲁木齐': 87.62, '克拉玛依': 84.87, '吐鲁番': 89.18, '哈密': 93.51,
    '昌吉': 87.30, '博尔塔拉': 82.07, '巴音郭楞': 86.15, '阿克苏': 80.27,
    '克孜勒苏': 76.17, '喀什': 75.99, '和田': 79.92, '伊犁': 81.32,
    '塔城': 82.99, '阿勒泰': 88.14, '石河子': 86.04,
    // 港澳台
    '香港': 114.17, '澳门': 113.55, '台北': 121.56, '高雄': 120.31, '台中': 120.68,
  };

  // 均时差（Equation of Time），输入 1-12 月返回该月近似分钟数（真太阳时 − 平太阳时）
  function equationOfTime(month, day) {
    // 以年内天数 N 估算，公式取常用近似（单位：分钟）
    const cumDays = [0, 0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    const N = (cumDays[month] || 0) + (day || 15);
    const B = 2 * Math.PI * (N - 81) / 364;
    return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  }

  // 根据出生地经度 + 钟表时分 + 日期，计算真太阳时对应的「小时(0-23)」
  // 返回 { hour, minute, deltaMin }；deltaMin 为校正总分钟数
  function trueSolarHour(lng, clockHour, clockMinute, month, day) {
    // 经度时差：标准时区基准 120°E，每偏 1° = 4 分钟
    const lngDelta = (lng - 120) * 4;            // 分钟
    const eot = equationOfTime(month, day);      // 分钟
    const deltaMin = lngDelta + eot;
    let total = clockHour * 60 + clockMinute + deltaMin;
    // 规整到 0–1440
    total = ((total % 1440) + 1440) % 1440;
    return { hour: Math.floor(total / 60), minute: Math.round(total % 60), deltaMin: deltaMin };
  }

  const TIME_LABELS = ['早子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时', '晚子时'];

  // 读取校正输入并更新时辰下拉 + 提示；返回是否成功应用了校正
  function applyTrueSolarTime() {
    const lngEl = $('birthLng'), hEl = $('birthHour'), mEl = $('birthMinute'), note = $('tstNote');
    const lng = parseFloat(lngEl.value);
    const ch = parseInt(hEl.value, 10);
    const cm = mEl.value === '' ? 0 : parseInt(mEl.value, 10);
    // 经度与钟点都需有效才计算
    if (isNaN(lng) || isNaN(ch) || ch < 0 || ch > 23) {
      note.style.display = 'none';
      note.className = 'tst-note';
      return false;
    }
    const mo = parseInt($('month').value, 10) || 6;
    const da = parseInt($('day').value, 10) || 15;
    const r = trueSolarHour(lng, ch, isNaN(cm) ? 0 : cm, mo, da);
    const idx = hourToTimeIndex(r.hour);
    $('timeIndex').value = idx;
    const sign = r.deltaMin >= 0 ? '+' : '−';
    const mm = (x) => (x < 10 ? '0' + x : '' + x);
    note.style.display = 'block';
    note.className = 'tst-note changed';
    note.innerHTML =
      `钟表时间 <b>${mm(ch)}:${mm(isNaN(cm) ? 0 : cm)}</b> ＋经度时差/均时差（${sign}${Math.abs(Math.round(r.deltaMin))} 分）` +
      ` → 真太阳时约 <b>${mm(r.hour)}:${mm(r.minute)}</b>，已自动定为 <b>${TIME_LABELS[idx]}</b>。` +
      `<br><span style="opacity:.8">如不需要校正，清空上方经度即可恢复手动选时辰。</span>`;
    return true;
  }

  // 顶部两条吸顶栏（topbar + tabs）的合计高度
  function stickyOffset() {
    const tb = document.querySelector('.topbar');
    const tabs = document.querySelector('.tabs');
    return (tb ? tb.offsetHeight : 0) + (tabs ? tabs.offsetHeight : 0);
  }

  // 滚动到「当前 tab 内容顶部」——刚好落在两条吸顶栏下方，
  // 既不被遮挡，也不会把上方个人信息表单露出来。
  function scrollToContentTop(smooth) {
    const pane = document.querySelector('.tab-pane.active');
    if (!pane) return;
    const y = pane.getBoundingClientRect().top + window.pageYOffset - stickyOffset();
    window.scrollTo({ top: Math.max(0, y), behavior: smooth === false ? 'auto' : 'smooth' });
  }

  // 把指定元素滚动到吸顶栏下方（用于定盘结果等局部定位）
  function scrollElBelowSticky(el, extra) {
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.pageYOffset - stickyOffset() - (extra || 12);
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }

  // 分段按钮通用绑定
  function bindSeg(segId, key, onChange) {
    const seg = $(segId);
    seg.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        seg.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state[key] = btn.dataset.val;
        if (onChange) onChange(btn.dataset.val);
      });
    });
  }

  function init() {
    bindSeg('genderSeg', 'gender');
    bindSeg('calSeg', 'cal', (v) => {
      $('leapField').style.display = v === 'lunar' ? 'flex' : 'none';
    });
    bindSeg('leapSeg', 'leap');

    // 默认：当前时间
    const _now = new Date();
    $('year').value = _now.getFullYear();
    $('month').value = _now.getMonth() + 1;
    $('day').value = _now.getDate();
    $('timeIndex').value = hourToTimeIndex(_now.getHours());

    $('paipanBtn').addEventListener('click', runPaipan);
    $('exportBtn').addEventListener('click', exportImage);
    $('toggleForm').addEventListener('click', () => {
      const p = $('formPanel');
      p.style.display = p.style.display === 'none' ? 'block' : 'none';
    });

    // 真太阳时校正：填充城市搜索列表 + 绑定联动
    (function initTrueSolar() {
      const sel = $('birthCity');
      const dl = $('cityList');
      if (dl) {
        Object.keys(CITY_LNG).forEach((city) => {
          const o = document.createElement('option');
          o.value = city;
          dl.appendChild(o);
        });
      }
      if (sel) {
        const onCity = () => {
          const v = sel.value.trim();
          if (v && CITY_LNG[v] != null) {
            $('birthLng').value = CITY_LNG[v];
          }
          applyTrueSolarTime();
        };
        sel.addEventListener('change', onCity);
        sel.addEventListener('input', onCity);
      }
      ['birthLng', 'birthHour', 'birthMinute'].forEach((id) => {
        const el = $(id);
        if (el) el.addEventListener('input', applyTrueSolarTime);
      });
      // 用户手动改时辰下拉时，视为放弃校正：清空提示
      $('timeIndex').addEventListener('change', () => {
        const note = $('tstNote');
        if (note) { note.style.display = 'none'; note.className = 'tst-note'; }
      });
    })();

    initTabs();
    initDingpan();
    syncJiepan();
  }

  // ---------- Tab 切换 ----------
  // opts.scroll: 切换后是否把内容滚动到吸顶栏正下方（用户点击 tab / 流程跳转时为 true）
  function switchTab(key, opts) {
    opts = opts || {};
    const tabs = $('tabs');
    const prev = (tabs.querySelector('.tab.active') || {}).dataset ? tabs.querySelector('.tab.active').dataset.tab : '';
    tabs.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === key));
    ['paipan', 'dingpan', 'jiepan-lite', 'jiepan'].forEach((k) => {
      const pane = $('tab-' + k);
      if (pane) pane.classList.toggle('active', k === key);
    });
    if (key !== prev) trk('tab_switch', { from: prev, to: key });
    if (key === 'dingpan') { trk('dingpan_enter', {}); syncDingpan(); }
    if (key === 'jiepan-lite') { trk('jiepan_lite_enter', {}); }
    if (key === 'jiepan') { trk('jiepan_enter', {}); syncJiepan(); }
    if (opts.scroll) requestAnimationFrame(function () { scrollToContentTop(true); });
  }

  function initTabs() {
    const tabs = $('tabs');
    tabs.querySelectorAll('.tab').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab, { scroll: true }));
    });
    // 通俗版占位区的「前往专业版」按钮
    const litePane = $('tab-jiepan-lite');
    if (litePane) {
      const proBtn = litePane.querySelector('[data-gnav="jiepan-pro"]');
      if (proBtn) {
        proBtn.addEventListener('click', () => {
          trk('jiepan_lite_to_pro', {});
          switchTab('jiepan', { scroll: true });
        });
      }
    }
  }

  // ---------- 排盘主流程 ----------
  function runPaipan() {
    const statusEl = $('status');
    statusEl.className = 'status-msg';
    statusEl.textContent = '';

    const y = parseInt($('year').value, 10);
    const m = parseInt($('month').value, 10);
    const d = parseInt($('day').value, 10);
    if (!y || !m || !d) {
      return showErr('请完整填写出生年月日');
    }
    if (m < 1 || m > 12 || d < 1 || d > 31) {
      return showErr('月份或日期超出范围');
    }

    const dateStr = `${y}-${m}-${d}`;
    // 排盘前：若填了真太阳时校正，先据此确定时辰下标
    applyTrueSolarTime();
    const timeIndex = parseInt($('timeIndex').value, 10);
    const gender = state.gender;
    const rawName = $('name').value.trim();
    const name = rawName || '匿名';
    const timeSel = $('timeIndex');
    const timeName = (timeSel && timeSel.options[timeSel.selectedIndex]) ? timeSel.options[timeSel.selectedIndex].text : '';
    const tstCity = $('birthCity') ? $('birthCity').value : '';
    const tstLng = $('birthLng') ? parseFloat($('birthLng').value) : NaN;
    const tstClock = ($('birthHour') && $('birthHour').value !== '')
      ? (($('birthHour').value || '') + ':' + ($('birthMinute').value || '00')) : '';
    const tstUsed = !isNaN(tstLng) && tstClock !== '';

    // 记录真太阳时换算详情，供解盘 Part1 展示
    if (tstUsed) {
      const _ch = parseInt($('birthHour').value, 10);
      const _cm = $('birthMinute').value === '' ? 0 : parseInt($('birthMinute').value, 10);
      const _r = trueSolarHour(tstLng, _ch, isNaN(_cm) ? 0 : _cm, m, d);
      const _mm = (x) => (x < 10 ? '0' + x : '' + x);
      state.tst = {
        used: true, city: tstCity, lng: tstLng,
        clock: `${_mm(_ch)}:${_mm(isNaN(_cm) ? 0 : _cm)}`,
        solar: `${_mm(_r.hour)}:${_mm(_r.minute)}`,
        delta: Math.round(_r.deltaMin),
        timeName: (TIME_LABELS[hourToTimeIndex(_r.hour)] || ''),
      };
    } else {
      state.tst = { used: false };
    }

    // 埋点：排盘提交（明文上报完整输入信息）
    trk('paipan_submit', {
      name: rawName,
      gender: gender,
      calendar: state.cal,
      leap: state.leap,
      birth_date: dateStr,
      birth_year: y,
      birth_month: m,
      birth_day: d,
      time_index: timeIndex,
      time_name: timeName,
      tst_used: tstUsed,
      tst_city: tstCity,
      tst_lng: isNaN(tstLng) ? '' : tstLng,
      tst_clock: tstClock,
    });

    try {
      let astrolabe;
      if (state.cal === 'lunar') {
        astrolabe = iztro.astro.byLunar(dateStr, timeIndex, gender, state.leap === 'yes', true, 'zh-CN');
      } else {
        astrolabe = iztro.astro.bySolar(dateStr, timeIndex, gender, true, 'zh-CN');
      }

      state.astro = astrolabe;
      state.data = buildData(astrolabe, name, timeIndex);

      renderBoard(state.data);
      renderReading(state.data);

      $('paipanEmpty').style.display = 'none';
      $('result').style.display = 'flex';
      $('exportBtn').disabled = false;
      statusEl.textContent = '排盘完成 ✓';

      // 埋点：排盘成功（命盘特征，无个人身份信息）
      (function () {
        var d = state.data || {};
        var mp = (d.palaces || []).find(function (p) { return p.name === '命宫'; });
        var mainStars = mp ? (mp.majorStars || []).map(function (s) { return s.name; }) : [];
        trk('paipan_success', {
          five_element: (d.fiveElementsClass || ''),
          soul_star: (d.soul || ''),
          body_star: (d.body || ''),
          main_stars: mainStars,
          zodiac: (d.zodiac || ''),
          sign: (d.sign || ''),
        });
      })();

      // 命盘已更新，重置定盘问卷与解盘解锁状态
      state.dpQuestions = [];
      state.dpAnswers = {};
      state.dpScore = null;
      state.jiepan = { unlocked: false, html: '' };
      syncJiepan();
      // 滚动到排盘内容顶部，落在吸顶栏下方（避免盘面被遮挡）
      requestAnimationFrame(function () { scrollToContentTop(true); });
    } catch (e) {
      console.error(e);
      showErr('排盘失败：' + (e && e.message ? e.message : '请检查输入'));
    }
  }

  function showErr(msg) {
    const s = $('status');
    s.className = 'status-msg err';
    s.textContent = msg;
  }

  // ---------- 数据组装 ----------
  function buildData(a, name, timeIndex) {
    const palaces = a.palaces.map((p, idx) => ({
      index: typeof p.index === 'number' ? p.index : idx,
      name: p.name,
      isBodyPalace: p.isBodyPalace,
      isOriginalPalace: p.isOriginalPalace,
      heavenlyStem: p.heavenlyStem,
      earthlyBranch: p.earthlyBranch,
      majorStars: mapStars(p.majorStars),
      minorStars: mapStars(p.minorStars),
      adjectiveStars: mapStars(p.adjectiveStars),
      changsheng12: p.changsheng12,
      boshi12: p.boshi12,
      decadal: p.decadal,
      ages: p.ages,
    }));

    return {
      name,
      gender: a.gender,
      solarDate: a.solarDate,
      lunarDate: a.lunarDate,
      chineseDate: a.chineseDate,
      time: a.time,
      timeRange: a.timeRange,
      sign: a.sign,
      zodiac: a.zodiac,
      soul: a.soul,
      body: a.body,
      fiveElementsClass: a.fiveElementsClass,
      soulBranch: a.earthlyBranchOfSoulPalace,
      bodyBranch: a.earthlyBranchOfBodyPalace,
      palaces,
    };
  }

  function mapStars(stars) {
    if (!stars) return [];
    return stars.map((s) => ({
      name: s.name, type: s.type, scope: s.scope,
      brightness: s.brightness || '', mutagen: s.mutagen || '',
    }));
  }

  // ---------- 盘面渲染 ----------
  function starCol(s, cls) {
    const lumaClass = (s.type === 'tianma' || s.type === 'lucun') ? ' luma' : '';
    const bright = s.brightness ? `<span class="star-bright">${s.brightness}</span>` : '';
    const mut = s.mutagen ? `<span class="star-mut mut-${s.mutagen}">${s.mutagen}</span>` : '';
    return `<div class="star-col ${cls}${lumaClass}"><span class="star-name">${s.name}</span>${bright}${mut}</div>`;
  }

  function palaceCell(p, data) {
    const tags = [];
    if (p.isBodyPalace) tags.push('<span class="tag body">身</span>');
    if (p.isOriginalPalace) tags.push('<span class="tag origin">来因</span>');
    const isSoul = p.name === '命宫';

    const majors = p.majorStars.map((s) => starCol(s, 'major')).join('');
    const minors = p.minorStars.map((s) => starCol(s, 'minor')).join('');
    const adjs = p.adjectiveStars.map((s) => starCol(s, 'adj')).join('');

    const decadalRange = p.decadal && p.decadal.range ? `${p.decadal.range[0]}-${p.decadal.range[1]}` : '';
    const minorAges = p.ages && p.ages.length ? p.ages.slice(0, 3).join('·') : '';

    const cls = ['palace'];
    if (isSoul) cls.push('soul');
    else if (p.isBodyPalace) cls.push('body-pal');

    return `
    <div class="${cls.join(' ')}">
      <div class="stars">${majors}${minors}${adjs}</div>
      <div class="palace-foot">
        <div class="foot-line1">
          <span class="foot-shen"><span>${p.changsheng12 || ''}</span><span>${p.boshi12 || ''}</span></span>
        </div>
        <div class="foot-line2">
          <span class="decadal-range">${decadalRange}</span>
          <span class="minor-ages">${minorAges}</span>
        </div>
        <div class="foot-line3">
          <span class="palace-name">${p.name}${tags.join('')}</span>
          <span class="ganzhi">${p.heavenlyStem}${p.earthlyBranch}</span>
        </div>
      </div>
    </div>`;
  }

  function centerInfo(d) {
    const rows = [
      ['性别', d.gender], ['生肖', d.zodiac],
      ['星座', d.sign], ['五行局', d.fiveElementsClass],
      ['命主', d.soul], ['身主', d.body],
      ['命宫', d.soulBranch], ['身宫', d.bodyBranch],
    ];
    return `
      <div class="ci-title">${d.name}</div>
      <div class="ci-sub">${d.solarDate} · ${d.time}</div>
      <div class="ci-rows">
        ${rows.map(([k, v]) => `<div class="ci-row"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}
        <div class="ci-row ci-full"><span class="k">农历</span><span class="v">${d.lunarDate}</span></div>
        <div class="ci-row ci-full"><span class="k">四柱</span><span class="v">${d.chineseDate}</span></div>
      </div>`;
  }

  function renderBoard(d) {
    const cells = Array.from({ length: 4 }, () => Array(4).fill(null));
    d.palaces.forEach((p) => {
      const pos = GRID_POS[p.earthlyBranch];
      if (pos) cells[pos[0]][pos[1]] = p;
    });

    let html = '';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (r === 1 && c === 1) {
          html += `<div class="center-info">${centerInfo(d)}</div>`;
          continue;
        }
        if ((r === 1 || r === 2) && (c === 1 || c === 2)) continue;
        const p = cells[r][c];
        html += p ? palaceCell(p, d) : '<div class="palace"></div>';
      }
    }
    $('board').innerHTML = html;

    // 绘制三方四正连线（命宫 + 财帛 + 官禄 三合，命宫↔迁移 对拱）
    drawSanfang(d);
  }

  // ---------- 三方四正连线 ----------
  // 命宫所在地支 -> 三合(财帛/官禄) + 对宫(迁移) 的地支，并连成虚线
  function drawSanfang(d) {
    const svg = $('sanfangLayer');
    if (!svg) return;
    svg.innerHTML = '';

    const soul = d.palaces.find((p) => p.name === '命宫');
    if (!soul) return;
    // 三方四正：命宫、对宫(迁移)、三合两宫(官禄/财帛)
    const targetNames = ['命宫', '迁移', '官禄', '财帛'];
    const branches = targetNames
      .map((nm) => { const p = d.palaces.find((x) => x.name === nm); return p ? p.earthlyBranch : null; })
      .filter(Boolean);

    // 用网格坐标算每宫格中心点（百分比），4 列 4 行
    const colW = 100 / 4, rowH = 100 / 4;
    const centerOf = (branch) => {
      const pos = GRID_POS[branch];
      if (!pos) return null;
      const [r, c] = pos;
      return { x: (c + 0.5) * colW, y: (r + 0.5) * rowH };
    };

    const pts = {};
    targetNames.forEach((nm) => {
      const p = d.palaces.find((x) => x.name === nm);
      if (p) pts[nm] = centerOf(p.earthlyBranch);
    });

    const NS = 'http://www.w3.org/2000/svg';
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');

    const mkLine = (a, b, cls) => {
      if (!a || !b) return;
      const ln = document.createElementNS(NS, 'line');
      ln.setAttribute('x1', a.x); ln.setAttribute('y1', a.y);
      ln.setAttribute('x2', b.x); ln.setAttribute('y2', b.y);
      ln.setAttribute('class', cls);
      ln.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(ln);
    };
    const mkNode = (a) => {
      if (!a) return;
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', a.x); c.setAttribute('cy', a.y); c.setAttribute('r', 0.7);
      c.setAttribute('class', 'sf-node');
      svg.appendChild(c);
    };

    // 三合三角：命宫-官禄-财帛 闭合
    mkLine(pts['命宫'], pts['官禄'], 'sf-line');
    mkLine(pts['官禄'], pts['财帛'], 'sf-line');
    mkLine(pts['财帛'], pts['命宫'], 'sf-line');
    // 对拱：命宫 ↔ 迁移
    mkLine(pts['命宫'], pts['迁移'], 'sf-line opp');

    // 节点标记
    ['命宫', '迁移', '官禄', '财帛'].forEach((nm) => mkNode(pts[nm]));
  }

  // ---------- 文字解读 ----------
  function findPalace(d, name) { return d.palaces.find((p) => p.name === name); }
  function starList(p) {
    const all = [...p.majorStars, ...p.minorStars];
    return all.map((s) => s.name);
  }
  function majorNames(p) { return p.majorStars.map((s) => s.name); }

  function mutBadge(m) { return `<span class="mut-badge mut-${m}">${m}</span>`; }

  function renderReading(d) {
    const L = [];

    // 星曜格式化：星名 + 亮度 + 四化标记（纯客观罗列，不做含义解读）
    const fmtStar = (s) => {
      const b = s.brightness ? `<span class="rd-bright">${s.brightness}</span>` : '';
      const m = s.mutagen ? mutBadge(s.mutagen) : '';
      return `<span class="star-hl">${s.name}</span>${b}${m}`;
    };
    const palaceStars = (p) => {
      const maj = (p.majorStars || []).map(fmtStar);
      const min = (p.minorStars || []).map(fmtStar);
      const adj = (p.adjectiveStars || []).map((s) => `<span class="rd-adj">${s.name}</span>`);
      const segs = [];
      segs.push(`<span class="rd-grp"><i>主星</i>${maj.length ? maj.join(' ') : '<em>无主星</em>'}</span>`);
      if (min.length) segs.push(`<span class="rd-grp"><i>辅星</i>${min.join(' ')}</span>`);
      if (adj.length) segs.push(`<span class="rd-grp"><i>杂曜</i>${adj.join(' ')}</span>`);
      return segs.join('');
    };
    const palCard = (p, label) => `<div class="rd-pal"><div class="rd-pal-h"><span class="pal-hl">${label || p.name}</span><span class="rd-gz">${p.heavenlyStem}${p.earthlyBranch}</span></div><div class="rd-pal-s">${palaceStars(p)}</div></div>`;

    // 命盘概览
    L.push('<h2>命盘概览</h2>');
    L.push(`<div class="lead">命主 <b>${d.name}</b>，${d.gender}命，生肖${d.zodiac}，${d.sign}。生于 ${d.solarDate}（农历 ${d.lunarDate}），${d.time}。八字四柱：${d.chineseDate}。<br>
      五行局 <span class="star-hl">${d.fiveElementsClass}</span> · 命主星 <span class="star-hl">${d.soul}</span> · 身主星 <span class="star-hl">${d.body}</span> · 命宫坐 ${d.soulBranch} · 身宫坐 ${d.bodyBranch}。</div>`);

    // 命宫
    const soul = findPalace(d, '命宫');
    if (soul) {
      L.push('<h2>命宫</h2>');
      L.push(`<div class="rd-grid">${palCard(soul)}</div>`);
    }

    // 三方四正（命宫 + 迁移 + 财帛 + 官禄）
    L.push('<h2>三方四正</h2>');
    L.push('<div class="rd-grid">');
    ['命宫', '迁移', '财帛', '官禄'].forEach((pn) => {
      const p = findPalace(d, pn);
      if (p) L.push(palCard(p));
    });
    L.push('</div>');

    // 各宫星曜分布（十二宫）
    L.push('<h2>各宫星曜分布</h2>');
    L.push('<div class="rd-grid">');
    d.palaces.forEach((p) => L.push(palCard(p)));
    L.push('</div>');

    // 生年四化（仅罗列：何星化何、落于何宫，不做含义解读）
    L.push('<h2>生年四化</h2>');
    const mutFound = [];
    d.palaces.forEach((p) => {
      [...p.majorStars, ...p.minorStars].forEach((s) => {
        if (s.mutagen) mutFound.push({ star: s.name, mut: s.mutagen, palace: p.name });
      });
    });
    if (mutFound.length) {
      const order = { '禄': 0, '权': 1, '科': 2, '忌': 3 };
      mutFound.sort((a, b) => (order[a.mut] ?? 9) - (order[b.mut] ?? 9));
      L.push('<ul class="rd-mut">');
      mutFound.forEach((m) => {
        L.push(`<li>${mutBadge(m.mut)} <b>${m.star}</b> 化${m.mut} —— 落于 <span class="pal-hl">${m.palace}</span></li>`);
      });
      L.push('</ul>');
    } else {
      L.push('<p>本盘生年四化信息从略。</p>');
    }

    // 使用引导：流程 + 理念 + 引导去定盘
    L.push(`
      <div class="rd-guide">
        <div class="rd-guide-h">如何使用这张盘？</div>
        <p class="rd-guide-lead">紫微斗数对<b>出生时辰</b>极为敏感——时辰差一格，整张盘就可能错位。因此本工具不急着下结论，而是先帮你<b>校验这张盘是否真的属于你</b>，再做解读。</p>
        <div class="rd-steps">
          <div class="rd-step done"><span class="rd-step-n">1</span><div class="rd-step-b"><div class="rd-step-t">排盘 <em>· 已完成</em></div><div class="rd-step-d">根据你的出生信息，生成上面这张命盘</div></div></div>
          <div class="rd-step"><span class="rd-step-n">2</span><div class="rd-step-b"><div class="rd-step-t">定盘 · 校验时辰</div><div class="rd-step-d">回答几个维度的问题，核对盘面与你本人的契合度，确认时辰是否准确</div></div></div>
          <div class="rd-step"><span class="rd-step-n">3</span><div class="rd-step-b"><div class="rd-step-t">解盘 · 深度解读</div><div class="rd-step-d">在盘面可信的前提下，自动生成完整解读</div></div></div>
        </div>
        <p class="rd-guide-tip">以上只是<b>原始盘面信息</b>，尚未解读。建议下一步先做「定盘」，确认这张盘确实属于你，再进入解盘。</p>
        <button id="toDingpanBtn" class="rd-guide-btn">前往定盘 · 校验时辰 →</button>
      </div>`);

    // 免责
    L.push(`<div class="disclaimer">说明：以上仅为命盘的客观星曜分布信息（命宫、三方四正、各宫星曜与生年四化），未作任何吉凶解读。紫微斗数属中国传统命理文化，仅供文化娱乐与自我了解参考，不构成对健康、寿命、婚姻、财富等的预测或决定性结论。</div>`);

    $('reading').innerHTML = L.join('\n');

    const toDp = document.getElementById('toDingpanBtn');
    if (toDp) toDp.addEventListener('click', () => switchTab('dingpan', { scroll: true }));
  }

  // ===================================================================
  // 定盘模块：基于命盘动态生成时辰校验问卷 + 四维度加权评分
  // ===================================================================

  // 主星 -> 性格/外貌描述（用于维度1的「贴合度」初筛）
  const STAR_PERSONA = {
    '紫微': '自尊心强、天生爱掌权与发号施令，待人有气场；长相偏方圆脸、五官端正、气质显贵',
    '天府': '稳重保守、善于持家与积累，重视安全感；体态丰润、面容温和带富态',
    '天机': '心思细腻、反应快、爱动脑也容易多虑；身形偏瘦小、眉眼灵动、神情机敏',
    '太阳': '外向热情、爱面子也乐于付出，行事光明磊落；偏圆脸、气色开朗、声音洪亮',
    '武曲': '性格硬朗务实、做事果决、重视金钱与效率；骨架结实、声音偏沉、表情刚毅',
    '天同': '温和随性、有孩子气、懂享受也怕麻烦；面相圆润可爱、笑容亲和',
    '廉贞': '感性敏感、好面子、桃花较重、情绪起伏大；眉眼带神采、气质独特有魅力',
    '太阴': '内向温柔、念旧细腻、重感情；皮肤偏白皙、面容清秀、气质安静',
    '贪狼': '欲望旺盛、多才多艺、交际手腕好、爱玩会享受；五官精致、毛发浓密、人缘活络',
    '巨门': '口才好、爱钻研也爱质疑、容易招口舌是非；眉宇间带思虑、说话有条理或犀利',
    '天相': '讲究体面、重衣食、乐于辅佐与协调、好商量；相貌端正、穿着得体、待人有礼',
    '天梁': '老成持重、爱照顾人、有长者风范、清高有原则；面相偏长、眉目慈祥稳重',
    '七杀': '独立刚强、冲劲足、不服输、说做就做；眼神锐利、骨架偏硬、行动力强',
    '破军': '叛逆好变动、敢破敢立、不安于现状、爱折腾；眉眼锐利、个性鲜明、不拘常规',
  };

  // 六亲宫 -> 校验角度
  const KIN_PALACES = [
    { name: '父母', label: '父母', angle: '父母的身体状况、与你的亲疏关系、家境与父母的职业性格' },
    { name: '兄弟', label: '兄弟姐妹', angle: '有无手足、手足数量，以及他们对你是助力还是牵绊' },
    { name: '夫妻', label: '婚姻配偶', angle: '早婚或晚婚、配偶的性格类型、婚姻是否多争吵或有离异波折' },
    { name: '子女', label: '子女', angle: '子女数量、亲子关系亲疏、子女是否有出息' },
  ];

  // 辅助验证宫
  const AUX_PALACES = [
    { name: '福德', label: '福德宫', angle: '睡眠质量、精神内耗程度、是否长期焦虑或情绪低落、福气厚薄' },
    { name: '疾厄', label: '疾厄宫', angle: '先天体质强弱、易出问题的身体部位（如心肺/肠胃/妇科/骨骼）' },
    { name: '迁移', label: '迁移宫', angle: '更适合离乡发展还是本地发展、外出在外是否容易破财或遇波折' },
  ];

  // 按大限「起运年龄」动态返回该十年的人生关键事件提示
  // （大限起运年龄随五行局浮动：水二2/木三3/金四4/土五5/火六6 起运，
  //   不能用固定年龄段去套，否则多数命盘会匹配不上而漏题——见 stageHint）

  // 档位定义（值越大越「符合」）
  const SCALE_OPTS = {
    '3': [
      { v: 1, label: '符合', cls: 'v-yes', score: 1.0 },
      { v: 0.5, label: '部分符合', cls: 'v-mid', score: 0.5 },
      { v: 0, label: '不符合', cls: 'v-no', score: 0.0 },
    ],
    '5': [
      { v: 1, label: '完全符合', cls: 'v-yes', score: 1.0 },
      { v: 0.75, label: '比较符合', cls: 'v-most', score: 0.75 },
      { v: 0.5, label: '一般', cls: 'v-mid', score: 0.5 },
      { v: 0.25, label: '不太符合', cls: 'v-less', score: 0.25 },
      { v: 0, label: '完全不符', cls: 'v-no', score: 0.0 },
    ],
  };
  const NA_OPT = { v: -1, label: '不确定', cls: 'v-na', score: null };

  // 四维度权重（六亲与大限事件最客观，权重最高）
  const DIM_WEIGHT = { d1: 1.0, d2: 1.6, d3: 2.0, d4: 1.2 };
  const DIM_TITLE = {
    d1: '维度一 · 性格外貌',
    d2: '维度二 · 六亲校验',
    d3: '维度三 · 过往大事',
    d4: '维度四 · 福德 / 疾厄 / 迁移',
  };
  const DIM_SUB = {
    d1: '最快初筛',
    d2: '客观事实 · 准确度最高',
    d3: '终极校验 · 最精准',
    d4: '辅助验证',
  };
  // 各维度的附加说明（展示在维度标题下方，不再逐题重复）
  const DIM_DESC = {
    d1: '若性格外貌明显对不上，往往是时辰记错的第一信号。',
    d2: '六亲是客观事实，最难主观修饰，准确度最高。',
    d3: '某盘大限流年与过往经历完全贴合、另一盘完全不符，即可锁定正确时辰。',
    d4: '',
  };

  function pMajors(d, name) {
    const p = findPalace(d, name);
    if (!p) return [];
    let ms = majorNames(p);
    if (!ms.length) {
      // 无主星借对宫
      const opp = OPP_PALACE[name];
      if (opp) { const q = findPalace(d, opp); if (q) ms = majorNames(q); }
    }
    return ms;
  }
  const OPP_PALACE = {
    '命宫': '迁移', '迁移': '命宫', '兄弟': '仆役', '仆役': '兄弟', '交友': '兄弟',
    '夫妻': '官禄', '官禄': '夫妻', '子女': '田宅', '田宅': '子女',
    '财帛': '福德', '福德': '财帛', '疾厄': '父母', '父母': '疾厄',
  };

  // 根据命盘构建问卷：每题 = 明确论断(claim) + 结合自身的询问(ask)
  function buildDpQuestions(d) {
    const qs = [];
    let qid = 0;
    const add = (dim, claim, ask, meta) => { qs.push(Object.assign({ id: 'q' + (qid++), dim, claim, ask: ask || '以上描述与你本人的真实情况符合吗？' }, meta || {})); };

    // —— 维度1：性格外貌（命宫主星，无主星借迁移）——
    const soulMs = pMajors(d, '命宫');
    if (soulMs.length) {
      soulMs.forEach((nm) => {
        if (STAR_PERSONA[nm]) {
          add('d1',
            `你的命宫主星是 <span class="q-hl">${nm}</span>。这类人通常表现为：<span class="q-key">${STAR_PERSONA[nm]}</span>。`,
            '请对照镜子里的自己和身边人对你的评价——你的性格与长相气质，符合上面这段描述吗？');
        }
      });
    } else {
      add('d1',
        `你的命宫没有主星（借对宫迁移宫论），这类人通常<span class="q-key">性格灵活多变、容易随环境与身边的人改变自己，缺乏固定主见，需要靠后天主动确立人生方向</span>。`,
        '回想你是不是这种「易受环境影响、立场和喜好常变」的人？符合吗？');
    }
    // 命宫辅星：桃花/贵人补充一问（具体化）
    const soulP = findPalace(d, '命宫');
    if (soulP) {
      const minor = soulP.minorStars.map((s) => s.name);
      const peach = minor.filter((n) => ['文昌', '文曲', '红鸾', '天喜', '左辅', '右弼', '天魁', '天钺'].includes(n));
      if (peach.length) {
        const traits = [];
        if (peach.some((n) => ['文昌', '文曲'].includes(n))) traits.push('读书时文科/写作表达不错、爱好文艺、重视学识');
        if (peach.some((n) => ['左辅', '右弼', '天魁', '天钺'].includes(n))) traits.push('人生关键时刻常有贵人或长辈出手相助');
        if (peach.some((n) => ['红鸾', '天喜'].includes(n))) traits.push('异性缘和人缘较好、长相讨喜');
        add('d1',
          `你的命宫还会照 <span class="q-hl">${peach.join('、')}</span> 等辅星，主你<span class="q-key">${traits.join('；')}</span>。`,
          '回想你的求学经历、人缘和贵人运，符合上面的说法吗？');
      }
    }

    // —— 维度2：六亲校验 ——
    KIN_PALACES.forEach((kp) => {
      const ms = pMajors(d, kp.name);
      const p = findPalace(d, kp.name);
      const muts = p ? [...p.majorStars, ...p.minorStars].filter((s) => s.mutagen).map((s) => `${s.name}化${s.mutagen}`) : [];
      const claim = kinClaim(kp.name, ms, muts);
      add('d2',
        `<span class="q-pal">${kp.label}</span>方面，你的命盘显示：<span class="q-key">${claim}</span>`,
        `请对照你真实的情况（${kp.angle}），符合吗？`);
    });

    // —— 维度3：过往大限/流年大事（遍历真实大限，按大运年限逐步出题）——
    const age = approxAge(d);
    const by = birthYear(d);
    // 取出命盘里全部有大限范围的宫位，按起运年龄排序
    const decadals = d.palaces
      .filter((p) => p.decadal && p.decadal.range && Array.isArray(p.decadal.range))
      .map((p) => ({ pal: p, start: p.decadal.range[0], end: p.decadal.range[1] }))
      .sort((a, b) => a.start - b.start);
    decadals.forEach((dec) => {
      // 只问已经历或正在进行的大限（起运年龄 ≤ 当前虚岁+1），未来的大限不出题
      if (age && dec.start > age + 1) return;
      const pal = dec.pal;
      const ms = majorNames(pal).length ? majorNames(pal) : pMajors(d, pal.name);
      const muts = [...pal.majorStars, ...pal.minorStars].filter((s) => s.mutagen).map((s) => `${s.name}化${s.mutagen}`);
      const claim = decadalClaim(pal.name, muts);
      // 虚岁 N 对应公历年 = 出生年 + N - 1
      const yrSpan = by ? `（约 ${by + dec.start - 1}–${by + dec.end - 1} 年）` : '';
      const isCurrent = age && age >= dec.start && age <= dec.end;
      const tag = isCurrent ? '（你正走在这步大限）' : '';
      add('d3',
        `<span class="q-hl">${dec.start}–${dec.end}岁</span>${yrSpan}这十年${tag}，你的大限走入 <span class="q-pal">${/宫$/.test(pal.name) ? pal.name : pal.name + '宫'}</span>${ms.length ? `（${ms.join('、')}）` : '（无主星）'}${muts.length ? `，引动 ${muts.join('、')}` : ''}。命盘判断：<span class="q-key">${claim}</span>`,
        `请具体回想这十年里实际发生过的大事（${stageHint(dec.start)}），上面这个判断对得上吗？`,
        { range: `${dec.start}-${dec.end}` });
    });
    // 维度3 收尾：区分「大运未开始」与「算不出虚岁」两种空维度情形
    if (!qs.some((q) => q.dim === 'd3')) {
      const earliestStart = decadals.length ? decadals[0].start : null;
      if (age && earliestStart != null && age < earliestStart) {
        // 大运尚未起运（年纪 < 最早起运年龄）：本就没有「过往大限」可校验，直接跳过 d3，不出兜底题
      } else {
        // 算不出虚岁（出生年缺失等）才给一道总括兜底题
        add('d3',
          `你的过往各个十年大限，吉凶起伏应当与命盘标注的旺衰节奏一致——顺的大限对应升学、就业、婚恋、置业等顺遂期，差的大限对应受挫、变动或健康问题。`,
          '回想你求学、初入职场、婚恋、置业、健康起伏的实际时间点，与命盘大限的吉凶起伏方向一致吗？');
      }
    }

    // —— 维度4：福德/疾厄/迁移 ——
    AUX_PALACES.forEach((ap) => {
      const ms = pMajors(d, ap.name);
      const p = findPalace(d, ap.name);
      const muts = p ? [...p.majorStars, ...p.minorStars].filter((s) => s.mutagen).map((s) => `${s.name}化${s.mutagen}`) : [];
      const claim = auxClaim(ap.name, ms, muts);
      add('d4',
        `<span class="q-pal">${ap.label}</span>方面，你的命盘显示：<span class="q-key">${claim}</span>`,
        `请对照你真实的情况（${ap.angle}），符合吗？`);
    });

    return qs;
  }

  // —— 六亲：明确具体的论断 ——
  function kinClaim(palace, ms, muts) {
    const hasJi = muts.some((m) => m.endsWith('忌'));
    const hasLu = muts.some((m) => m.endsWith('禄'));
    const set = new Set(ms);
    if (palace === '父母') {
      if (hasJi) return '你与父母（尤其其中一方）缘分较浅或聚少离多，父母之一的身体曾出过较明显的状况，亲子关系里带有距离感或代沟。';
      if (set.has('太阳') || set.has('天梁')) return '你的父亲或家中长辈较有担当、责任感强或有一定社会地位，对你有实际的庇荫和帮助，家境中等偏上。';
      return '你与父母关系总体平和、各有主见，家境普通，父母健康没有大问题。';
    }
    if (palace === '兄弟') {
      if (set.has('天机') || hasJi) return '你的兄弟姐妹数量不多（或为独生子女），与手足之间助力有限、各忙各的，相处时需要多包容迁就。';
      if (set.has('天府') || set.has('天同') || hasLu) return '你有兄弟姐妹且关系融洽，彼此能在生活或事业上互相帮衬、感情不错。';
      return '你的手足关系比较普通，平时各自发展、来往不算频繁。';
    }
    if (palace === '夫妻') {
      if (set.has('破军') || set.has('七杀') || set.has('贪狼') || hasJi) return '你的婚姻感情波折比较明显：适合晚婚，恋爱或婚姻中容易出现争吵、聚散或重大变动，配偶个性较强、彼此磨合不易。';
      if (set.has('天同') || set.has('太阴') || set.has('天相') || hasLu) return '你的配偶（或对象）性情偏温和顾家，感情以细水长流为主，婚姻相对平稳。';
      return '你的婚姻感情状态中性，好坏主要取决于双方后天的经营。';
    }
    if (palace === '子女') {
      if (hasJi || set.has('七杀') || set.has('破军')) return '你的子女缘需要用心经营（或子女偏少、偏晚得子），孩子个性较强、有主见，亲子之间需要多沟通。';
      if (set.has('天同') || set.has('太阴') || hasLu) return '你与子女关系亲密，孩子较乖巧贴心、让你省心。';
      return '你的子女关系中性，亲疏主要看后天相处。';
    }
    return '该宫星情中性。';
  }

  // —— 大限：明确到「这十年大概会发生什么」的论断 ——
  function decadalClaim(palace, muts) {
    const hasJi = muts.some((m) => m.endsWith('忌'));
    const hasLu = muts.some((m) => m.endsWith('禄'));
    const hasQuan = muts.some((m) => m.endsWith('权'));
    const good = hasLu || hasQuan;
    const map = {
      '命宫': good
        ? '这是你确立自我、人生明显上台阶的十年：很可能经历一次重要的身份转变、能力跃升或抓住关键机会，整体是上升期。'
        : (hasJi
          ? '这是你重新认识自己、被迫调整方向的十年：可能经历一次较大的人生抉择、自我怀疑或方向上的明显转折。'
          : '这是你确立自我方向、性格逐渐成型的十年，会有比较关键的人生选择。'),
      '官禄': good
        ? '这十年你的事业/学业明显上升：很可能经历升学顺利、找到正式工作、职位晋升或收入显著增加。'
        : (hasJi
          ? '这十年你的事业/学业容易遇到明显阻碍或转折：可能有考试失利、工作变动、失业、被迫转行或事业受挫。'
          : '这十年事业学业是你的重心，会有明显的发展或调整。'),
      '财帛': good
        ? '这十年钱财进出是你的主轴：很可能有一次明显的赚钱机会、收入大涨或一笔较大的进账。'
        : (hasJi
          ? '这十年要特别留意财务：可能经历一次破财、投资亏损、负债或一笔大额的被动支出。'
          : '这十年理财、收支是你关注的焦点，钱财上会有较明显的进出。'),
      '夫妻': good
        ? '这十年是你的感情/婚姻高峰期：很可能经历恋爱、结婚、同居等重大的感情喜事。'
        : (hasJi
          ? '这十年感情容易起波澜：可能经历分手、感情破裂、婚姻争执甚至离异等明显的感情事件。'
          : '这十年感情婚姻议题突出，很可能有结婚或重大感情变化。'),
      '田宅': good
        ? '这十年家庭与不动产是重点：很可能买房、置产、搬入新居或家里添丁等喜事。'
        : (hasJi
          ? '这十年居所或家庭容易有变动：可能搬家频繁、卖房、家庭结构变化或与家人有较大摩擦。'
          : '这十年家庭、买房、搬迁是主轴，居住环境会有明显变化。'),
      '疾厄': hasJi
        ? '这十年健康亮红灯：很可能经历一次明显的疾病、手术或身体某部位反复出问题，压力也偏大。'
        : '这十年健康和压力需要多留意，可能有一段身体调养期或慢性小毛病。',
      '福德': good
        ? '这十年你心境逐渐开阔、找到兴趣或信仰寄托，精神上比较充实满足。'
        : (hasJi
          ? '这十年你精神压力偏大、思虑多，可能经历一段失眠、焦虑或情绪低落的时期。'
          : '这十年你的精神状态、兴趣爱好会有明显转折。'),
      '父母': good
        ? '这十年与长辈/上司、文书学业关系密切且顺：可能升学考证顺利、得长辈或上司提拔。'
        : (hasJi
          ? '这十年要留意父母长辈的健康，或与上司、文书合约方面有较大的变动或纠纷。'
          : '这十年与父母长辈、上司、考试文书关联较深，会有相关的重要事件。'),
      '迁移': good
        ? '这十年外出变动多且有利：很可能搬迁、出国、异地求学或工作，人际圈大幅扩展、在外得意。'
        : (hasJi
          ? '这十年外出奔波且需防意外破财：可能异地辗转、人际是非多或出门遇到波折。'
          : '这十年外出、搬迁、异地发展是主轴，活动范围明显扩大。'),
    };
    if (map[palace]) return map[palace];
    // 兄弟/仆役等
    return good
      ? '这十年人际与合作是重点，很可能与手足、朋友或合伙人有重要的成功合作。'
      : (hasJi
        ? '这十年要留意人际与合作：可能与手足、朋友、合伙人发生明显的摩擦、拆伙或被拖累。'
        : '这十年人际、平辈、合作关系是你生活的重点之一。');
  }

  // —— 福德/疾厄/迁移：明确具体的论断 ——
  function auxClaim(palace, ms, muts) {
    const hasJi = muts.some((m) => m.endsWith('忌'));
    const set = new Set(ms);
    if (palace === '福德') {
      if (hasJi || set.has('巨门') || set.has('廉贞')) return '你平时思虑偏多、容易精神内耗，睡眠质量一般，遇事爱想太多、容易焦虑紧张。';
      if (set.has('天同') || set.has('天府') || set.has('天梁')) return '你心性比较安定、懂得享受生活，整体福气较厚，不太钻牛角尖。';
      return '你的精神状态中性，时好时坏，谈不上特别焦虑也谈不上特别豁达。';
    }
    if (palace === '疾厄') {
      let part = '身体素质总体均衡';
      if (set.has('武曲') || set.has('七杀')) part = '呼吸系统、筋骨关节（如肺、气管、骨骼）是相对薄弱、容易出毛病的地方';
      else if (set.has('巨门') || set.has('天同')) part = '肠胃、消化或泌尿系统是相对薄弱、容易出毛病的地方';
      else if (set.has('廉贞') || set.has('贪狼')) part = '内分泌或妇科/生殖系统是相对薄弱、容易出毛病的地方';
      else if (set.has('太阴')) part = '睡眠、阴分（如内分泌、水液代谢）是相对薄弱、容易出毛病的地方';
      return `你的先天体质${hasJi ? '有某些部位需要长期保养' : '总体平稳'}，其中${part}。`;
    }
    if (palace === '迁移') {
      if (set.has('七杀') || set.has('破军') || set.has('贪狼')) return '你更适合离开出生地到外地发展，在外奔波、动中求财、闯荡的机会比守在本地多。';
      if (hasJi) return '你外出在外要留意破财或意外波折，远行、异地发展时宜更稳健保守。';
      return '你本地、外地发展皆可，外出际遇平稳、没有特别的吉凶。';
    }
    return '该宫提示中性。';
  }

  function approxAge(d) {
    // 从 solarDate 估算虚岁
    try {
      const y = parseInt(String(d.solarDate).split('-')[0], 10);
      if (!y) return null;
      const now = new Date().getFullYear();
      return now - y + 1;
    } catch (e) { return null; }
  }
  function birthYear(d) {
    try {
      const y = parseInt(String(d.solarDate).split('-')[0], 10);
      return y || null;
    } catch (e) { return null; }
  }
  // 按大限「起运年龄」返回该十年对应的人生阶段提示（起运浮动，用区间归类）
  function stageHint(startAge) {
    if (startAge <= 5) return '婴幼儿与启蒙：身体状况、家庭氛围、是否常生病或搬家';
    if (startAge <= 15) return '童年到少年求学：学业起步、性格养成、身体与家境变化';
    if (startAge <= 25) return '升学高考/考研、读大学、初入社会、初恋';
    if (startAge <= 35) return '第一份正式工作、转行跳槽、恋爱结婚、生子、首次置业';
    if (startAge <= 45) return '事业升迁或瓶颈、婚姻稳定或变动、子女教育、买房换房';
    if (startAge <= 55) return '事业高峰或转型、财富积累或起落、健康开始受关注';
    if (startAge <= 65) return '事业收尾退休、财务规划、健康问题、子女成家、亲人变化';
    return '晚年生活、健康养护、含饴弄孙、家族传承';
  }

  // ---------- 定盘渲染 ----------
  function initDingpan() {
    $('dpSubmit').addEventListener('click', submitDingpan);
    $('dpReset').addEventListener('click', () => {
      state.dpAnswers = {};
      renderDpQuestions();
      $('dpResult').style.display = 'none';
      updateDpProgress();
    });
  }

  function syncDingpan() {
    const hasChart = !!state.data;
    $('dingpanEmpty').style.display = hasChart ? 'none' : 'block';
    $('dingpanBody').style.display = hasChart ? 'block' : 'none';
    if (!hasChart) return;
    if (!state.dpQuestions.length) {
      state.dpQuestions = buildDpQuestions(state.data);
      state.dpAnswers = {};
      $('dpResult').style.display = 'none';
    }
    renderDpQuestions();
    updateDpProgress();
  }

  function renderDpQuestions() {
    const dims = ['d1', 'd2', 'd3', 'd4'];
    const opts = SCALE_OPTS[state.dpScale];
    let html = '';
    dims.forEach((dim) => {
      const list = state.dpQuestions.filter((q) => q.dim === dim);
      if (!list.length) return;
      html += `<div class="dp-dim">
        <div class="dp-dim-head">
          <span class="dp-dim-no">${dim[1]}</span>
          <span class="dp-dim-title">${DIM_TITLE[dim]}</span>
          <span class="dp-dim-sub">${DIM_SUB[dim]} · ${list.length} 题</span>
        </div>
        ${DIM_DESC[dim] ? `<div class="dp-dim-desc">${DIM_DESC[dim]}</div>` : ''}`;
      list.forEach((q) => {
        const cur = state.dpAnswers[q.id];
        const optBtns = opts.map((o) => {
          const sel = (cur !== undefined && Math.abs(cur - o.score) < 1e-6) ? ` sel ${o.cls}` : '';
          return `<div class="dp-opt${sel}" data-qid="${q.id}" data-score="${o.score}">${o.label}</div>`;
        }).join('');
        const naSel = (cur === null) ? ' sel v-na' : '';
        const naBtn = `<div class="dp-opt${naSel}" data-qid="${q.id}" data-score="na">${NA_OPT.label}</div>`;
        html += `<div class="dp-q">
          <div class="dp-q-claim">${q.claim}</div>
          <div class="dp-q-ask">${q.ask}</div>
          <div class="dp-opts">${optBtns}${naBtn}</div>
        </div>`;
      });
      html += '</div>';
    });
    $('dpQuestions').innerHTML = html;

    // 绑定选项点击
    $('dpQuestions').querySelectorAll('.dp-opt').forEach((el) => {
      el.addEventListener('click', () => {
        const qid = el.dataset.qid;
        const sc = el.dataset.score;
        state.dpAnswers[qid] = (sc === 'na') ? null : parseFloat(sc);
        // 埋点：单题作答
        (function () {
          var q = state.dpQuestions.find(function (x) { return x.id === qid; }) || {};
          trk('dingpan_answer', {
            dim: q.dim || '',
            q_id: qid,
            choice: (sc === 'na') ? 'unsure' : parseFloat(sc),
            decadal_range: q.range || '',
          });
        })();
        // 更新同题选中态
        const group = el.parentElement;
        group.querySelectorAll('.dp-opt').forEach((b) => {
          b.className = 'dp-opt';
        });
        // 重设当前
        renderDpAnswerState(group, qid);
        updateDpProgress();
      });
    });
  }

  function renderDpAnswerState(group, qid) {
    const cur = state.dpAnswers[qid];
    const opts = SCALE_OPTS[state.dpScale];
    group.querySelectorAll('.dp-opt').forEach((b) => {
      const sc = b.dataset.score;
      if (sc === 'na') {
        if (cur === null) b.className = 'dp-opt sel v-na';
        return;
      }
      const o = opts.find((x) => Math.abs(x.score - parseFloat(sc)) < 1e-6);
      if (cur !== undefined && cur !== null && Math.abs(cur - parseFloat(sc)) < 1e-6) {
        b.className = `dp-opt sel ${o ? o.cls : ''}`;
      }
    });
  }

  function updateDpProgress() {
    const total = state.dpQuestions.length;
    const answered = Object.keys(state.dpAnswers).length;
    $('dpProgress').textContent = `已作答 ${answered} / ${total} 题`;
  }

  // ---------- 定盘评分 ----------
  function submitDingpan() {
    const total = state.dpQuestions.length;
    const answered = Object.keys(state.dpAnswers).length;
    if (answered < total) {
      $('dpProgress').textContent = `还有 ${total - answered} 题未作答，请完整作答后再提交`;
      $('dpProgress').classList.add('err');
      setTimeout(() => $('dpProgress').classList.remove('err'), 2500);
      return;
    }
    const result = computeDpScore();
    state.dpScore = result.overall;
    state.dpDetail = result.dimScore || null;   // 供解盘 Part1「定盘校验结果」展示
    // 埋点：定盘提交（点击「提交」即带上评分结果与四维分项）
    (function () {
      var ds = result.dimScore || {};
      function pct(d) { return (ds[d] && ds[d].pct != null) ? Math.round(ds[d].pct) : null; }
      var payload = {
        total: total,
        answered: answered,
        score: result.overall,
        passed: result.overall >= JIEPAN_PASS,
        d1: pct('d1'), d2: pct('d2'), d3: pct('d3'), d4: pct('d4'),
      };
      trk('dingpan_submit', payload);
      // 兼容历史：保留独立的结果事件
      trk('dingpan_result', {
        score: result.overall,
        passed: result.overall >= JIEPAN_PASS,
        d1: pct('d1'), d2: pct('d2'), d3: pct('d3'), d4: pct('d4'),
      });
    })();
    renderDpResult(result);
    $('dpResult').style.display = 'block';
    // 把评分结果滚动到吸顶栏下方，避免被遮挡
    requestAnimationFrame(function () { scrollElBelowSticky($('dpResult'), 12); });
  }

  function computeDpScore() {
    const dims = ['d1', 'd2', 'd3', 'd4'];
    const dimScore = {};
    let wSum = 0, wScore = 0;
    dims.forEach((dim) => {
      const list = state.dpQuestions.filter((q) => q.dim === dim);
      let sum = 0, cnt = 0;
      list.forEach((q) => {
        const a = state.dpAnswers[q.id];
        if (a === null || a === undefined) return; // 不确定不计分
        sum += a; cnt++;
      });
      const pct = cnt ? (sum / cnt) * 100 : null;
      dimScore[dim] = { pct, cnt, total: list.length };
      if (pct !== null) {
        const w = DIM_WEIGHT[dim];
        wSum += w; wScore += w * pct;
      }
    });
    const overall = wSum ? Math.round(wScore / wSum) : 0;
    return { overall, dimScore };
  }

  function scoreColor(pct) {
    if (pct >= 75) return '#1f9d55';
    if (pct >= 55) return '#b0883c';
    if (pct >= 40) return '#d2664f';
    return '#8a8f96';
  }

  function renderDpResult(r) {
    const { overall, dimScore } = r;
    const color = scoreColor(overall);

    let verdict, badge, badgeColor, advice;
    if (overall >= 75) {
      verdict = '命盘与本人高度契合，时辰大概率正确';
      badge = '契合度高'; badgeColor = '#1f9d55';
      advice = '各维度普遍贴合，尤其是六亲与过往大事这类客观项也对得上，<b>这个时辰可以放心采用</b>。值得进一步做深度解盘与大限流年预测。';
    } else if (overall >= 55) {
      verdict = '基本契合，时辰大体可用但建议复核';
      badge = '契合度中上'; badgeColor = '#b0883c';
      advice = '主要轮廓对得上，但有部分维度偏弱。建议重点复核得分最低的维度，<b>若客观项（六亲、大事）无明显冲突，即可采用</b>，再进一步解盘。';
    } else if (overall >= 40) {
      verdict = '契合度一般，时辰存疑，建议比对邻近时辰';
      badge = '契合度偏低'; badgeColor = '#d2664f';
      advice = '多个维度对不上，尤其要警惕客观项（六亲/过往大事）的偏差。建议<b>用前后相邻的时辰各排一盘做对照</b>，挑选最贴合的再解盘，否则预测易失准。';
    } else {
      verdict = '契合度低，时辰很可能有误';
      badge = '契合度低'; badgeColor = '#8a8f96';
      advice = '命盘与本人差异明显，<b>不建议直接用此盘做预测</b>。请先确认出生时辰（可参考出生证明、询问长辈），或逐一试排 12 个时辰，找出六亲与过往大事最吻合的那一个。';
    }

    let html = `<div class="dp-score-top">
      <div class="dp-gauge" style="background:linear-gradient(135deg, ${color}, ${shade(color)});">
        <span class="g-num">${overall}</span><span class="g-unit">契合分</span>
      </div>
      <div class="dp-verdict">
        <span class="dp-badge" style="background:${badgeColor}">${badge}</span>
        <h3>${verdict}</h3>
        <p>${advice}</p>
      </div>
    </div>`;

    // 维度条形
    html += `<div class="dp-dim-scores"><h4>各维度契合度（权重越高越客观）</h4>`;
    ['d1', 'd2', 'd3', 'd4'].forEach((dim) => {
      const ds = dimScore[dim];
      if (!ds || ds.total === 0) return;
      const pct = ds.pct === null ? 0 : Math.round(ds.pct);
      const na = ds.total - ds.cnt;
      const c = ds.pct === null ? '#c8ccd2' : scoreColor(ds.pct);
      const label = `${DIM_TITLE[dim].replace('维度', '维').split(' · ')[0]}·${DIM_TITLE[dim].split(' · ')[1]}`;
      html += `<div class="dp-bar-row">
        <span class="dp-bar-label">${DIM_TITLE[dim].split(' · ')[1]} <span style="color:#bbb;font-size:11px;">×${DIM_WEIGHT[dim]}</span></span>
        <span class="dp-bar-track"><span class="dp-bar-fill" style="width:${pct}%;background:${c};"></span></span>
        <span class="dp-bar-val">${ds.pct === null ? '—' : pct + '%'}${na ? `<span style="color:#bbb;font-size:11px;"> (${na}不确定)</span>` : ''}</span>
      </div>`;
    });
    html += `</div>`;

    // 针对性提示：找最弱维度
    const valid = ['d1', 'd2', 'd3', 'd4'].filter((dim) => dimScore[dim] && dimScore[dim].pct !== null);
    if (valid.length) {
      const weakest = valid.reduce((a, b) => (dimScore[a].pct <= dimScore[b].pct ? a : b));
      const wp = Math.round(dimScore[weakest].pct);
      let tip = '';
      if (wp < 55) {
        const tipMap = {
          d1: '性格外貌偏差通常意味着命宫主星错位——这是时辰错误最直接的信号，优先怀疑时辰。',
          d2: '六亲（父母/手足/婚姻/子女）是最客观的事实，对不上时时辰出错的可能性很大，强烈建议比对邻近时辰。',
          d3: '过往大限大事对不上是最严重的警讯——大限以十年为界，错一个时辰整条时间轴都会偏，请重点核对。',
          d4: '福德/疾厄/迁移偏差可作辅助参考，单独偏低影响相对小，但若与其他维度同时偏弱则需警惕。',
        };
        tip = `<div class="dp-tips">⚠️ 当前最薄弱的是 <b>${DIM_TITLE[weakest].split(' · ')[1]}</b>（${wp}%）。${tipMap[weakest]}</div>`;
      } else {
        tip = `<div class="dp-tips">✓ 各维度均较均衡，没有明显短板，时辰可信度较高。</div>`;
      }
      html += tip;
    }

    html += `<div class="dp-disclaimer">说明：定盘评分依据「你的主观符合判断 × 各维度客观权重」加权得出，用于辅助判断出生时辰是否准确，<b>不构成命理结论本身</b>。六亲与过往大事权重最高，因其最难主观附会；性格外貌为快速初筛。最终是否采用某时辰，仍建议结合出生证明等客观信息综合判断。</div>`;

    // —— 去向引导：根据是否达到解盘门槛给出不同的下一步 ——
    const passed = overall >= JIEPAN_PASS;
    html += `<div class="dp-next">
      <div class="dp-next-head">
        <span class="dp-next-ico">${passed ? '✓' : '!'}</span>
        <div>
          <h4>${passed ? '时辰已校验通过，可以进入解盘' : `契合分未达 ${JIEPAN_PASS} 分，建议先校正时辰`}</h4>
          <p>${passed
            ? '你的命盘与本人契合度已达解盘门槛，下面这张盘可以放心用于深度解读。请选择下一步：'
            : `解盘建立在「时辰正确」的前提上。当前契合分为 <b>${overall}</b>，尚未达到 <b>${JIEPAN_PASS}</b> 分的解盘门槛，直接解读容易失准。建议先调整时辰重新排盘，或补全更客观的出生信息后再来。`}</p>
        </div>
      </div>
      <div class="dp-next-actions">
        <button class="nav-btn nav-back" data-nav="paipan">
          <span class="nav-btn-t">调整信息 · 重新排盘</span>
          <span class="nav-btn-d">回到排盘页修改出生时辰 / 历法等，重新生成命盘</span>
        </button>
        ${passed
          ? `<button class="nav-btn nav-go" data-nav="dojiepan">
              <span class="nav-btn-t">触发解盘 · 生成命理详批 →</span>
              <span class="nav-btn-d">基于本盘多维度自动生成完整解读，并跳转到解盘页查看</span>
            </button>`
          : `<button class="nav-btn nav-disabled" disabled>
              <span class="nav-btn-t">解盘暂未解锁 🔒</span>
              <span class="nav-btn-d">契合分达到 ${JIEPAN_PASS} 分后自动开放</span>
            </button>`}
      </div>
    </div>`;

    $('dpResult').innerHTML = html;

    // 绑定去向按钮
    $('dpResult').querySelectorAll('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nav = btn.dataset.nav;
        if (nav === 'paipan') {
          trk('nav_repaipan', { from: 'dingpan_result', score: state.dpScore });
          switchTab('paipan');
          $('formPanel').style.display = 'block';
          $('formPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (nav === 'dojiepan') {
          trk('jiepan_unlock', { score: state.dpScore, from: 'dingpan_result' });
          trk('jiepan_generate', { score: state.dpScore });
          state.jiepan.unlocked = true;
          state.jiepan.html = buildJiepan(state.data);
          switchTab('jiepan');
          syncJiepan();
          // 保持 tab 吸顶，仅滚动到解盘内容顶部（不露出上方个人信息表单）
          requestAnimationFrame(function () { scrollToContentTop(true); });
        }
      });
    });
    return;
  }

  // 颜色加深（生成渐变第二色）
  function shade(hex) {
    const m = hex.replace('#', '');
    const r = Math.max(0, parseInt(m.slice(0, 2), 16) - 30);
    const g = Math.max(0, parseInt(m.slice(2, 4), 16) - 30);
    const b = Math.max(0, parseInt(m.slice(4, 6), 16) - 30);
    return `rgb(${r},${g},${b})`;
  }

  // ===================================================================
  // 解盘模块：多维度、结构化的命理详批（仅在定盘契合分≥70 时解锁）
  // ===================================================================

  // 主星 -> 事业取向（风格 + 适合领域 + 一句话建议）
  const STAR_CAREER = {
    '紫微': { style: '适合居于领导、统筹、决策的位置，天生有管理与号召力', field: '管理、政府机关、大型企业高层、品牌主理、自主创业', tip: '宜往「掌舵者」方向走，最忌长期屈居人下、被外行管理' },
    '天府': { style: '稳健保守、长于守成与资源调度，适合掌管钱库与后勤', field: '财务、金融、不动产、行政管理、稳定的大机构', tip: '宜稳扎稳打、积累资源，不宜冒进豪赌' },
    '天机': { style: '善谋略、企划与分析，是天生的军师与策划脑', field: '策划、咨询、研发、参谋幕僚、技术、宗教哲学', tip: '适合出谋划策而非冲锋陷阵，宜专精一门技艺' },
    '太阳': { style: '热情博爱、乐于付出与发光发热，适合公众与服务型事业', field: '教育、传媒、公职、外贸、需要曝光与影响力的行业', tip: '宜往光明正大、能照顾众人的舞台发展，忌过度操劳' },
    '武曲': { style: '务实果决、行动力强、对数字与效率敏感，是财经实干家', field: '金融、财会、军警、工程、五金机械、自主营商', tip: '靠专业与执行力赚钱，宜刚中带柔、避免因刚直伤人脉' },
    '天同': { style: '温和亲切、重生活品质，适合在稳定环境里发挥协调力', field: '服务业、餐饮、休闲、设计、福利与文教类', tip: '宜找有兴趣、压力适中的领域，不必强求争强斗狠' },
    '廉贞': { style: '能屈能伸、有政治手腕与艺术感，擅长在复杂关系里斡旋', field: '业务公关、政界、设计艺术、娱乐、电子科技', tip: '善用人际手腕，但须守住分寸与原则，避免感情用事' },
    '太阴': { style: '细腻内敛、审美与规划力佳，长于在幕后稳步经营', field: '财务、地产、文创、女性相关产业、夜间或海外事业', tip: '宜以柔克刚、细水长流，财富多靠积累而非暴发' },
    '贪狼': { style: '多才多艺、交际广、嗅觉敏锐，适合需要人脉与应变的行业', field: '业务、公关、娱乐、餐饮、美容、命理五术、投资', tip: '才华横溢但忌贪多，宜专注一两项做深做透' },
    '巨门': { style: '口才与钻研力强，靠专业与「一张嘴」立身', field: '律师、教师、主播、销售、医疗、研究、餐饮', tip: '以口生财、以专业服人，须慎防口舌是非与小人' },
    '天相': { style: '辅佐协调一流、重信誉与体面，是最佳的二把手与执行官', field: '行政、秘书幕僚、金融、服务、采购、外交协调', tip: '宜辅佐贤主、稳中求进，适合在大平台里担当中坚' },
    '天梁': { style: '老成稳重、有原则与化解力，适合监督、把关与照顾型事业', field: '医疗、法律、监察、教育、宗教、保险与管理', tip: '宜走专业与公益兼具之路，逢凶能化吉，但忌孤高' },
    '七杀': { style: '魄力十足、独当一面、不畏挑战，是开疆拓土型人才', field: '军警、工程、业务、创业、机械、需要拼劲的行业', tip: '宜独立创业或带兵打仗，最怕被束缚，须防孤注一掷' },
    '破军': { style: '敢破敢立、勇于变革，适合开创、转型与从零到一', field: '创业、销售、工程、海运物流、变动大的新兴行业', tip: '先破后立、不安于现状，宜把变动化为创新动力' },
  };

  // 主星 -> 财富格局（赚钱方式 + 理财风格）
  const STAR_WEALTH = {
    '紫微': '财源多与地位、权力相伴，宜靠事业地位带动财富，理财偏好稳健与体面消费',
    '天府': '天生财库，善守财与积累，理财保守稳健，是十足的「存得住钱」之人',
    '天机': '财来自智慧与企划，进出较灵活，宜以专业技能生财，避免投机',
    '太阳': '靠付出、名气与事业格局生财，不太计较小钱，宜开源更宜节流',
    '武曲': '正财星、最善理财与生意，靠专业实干赚钱，对数字敏感，宜稳中求富',
    '天同': '财来得较平顺、重生活享受，理财偏随性，宜建立强制储蓄习惯',
    '廉贞': '财路多与人脉、业务、艺术相关，进出较大，须防为情为面子破财',
    '太阴': '善积累的财星，靠细水长流与不动产致富，理财细致，多有私房积蓄',
    '贪狼': '偏财与机遇财较旺，靠才艺人脉生财，理财大胆，宜节制欲望避免大起大落',
    '巨门': '靠口才、专业与服务赚钱，财路稳但需防是非耗财，宜量入为出',
    '天相': '财随事业平稳而来，重信誉与体面，理财中庸稳健，少有大风险',
    '天梁': '财多与专业、长辈、庇荫相关，不重钱财本身，宜以专业与口碑立身',
    '七杀': '财来得猛去得也快，靠拼搏与开创赚钱，理财宜留余地、忌孤注一掷',
    '破军': '财富起伏大、先破后立，靠变动与开创生财，宜分散风险、稳健配置',
  };

  // 主星 -> 感情态度（在夫妻宫的表现）
  const STAR_LOVE = {
    '紫微': '择偶眼光高、重对方条件与体面，婚后掌主导权，宜避免过于强势',
    '天府': '重视安稳与物质保障，配偶多顾家务实，婚姻偏稳定长久',
    '天机': '感情中思虑多、易因想太多而患得患失，宜多沟通、减少猜疑',
    '太阳': '对感情热情大方、肯付出，但易因太忙于事业而疏于经营',
    '武曲': '感情表达较直接刚硬、不善甜言蜜语，宜晚婚、多些柔软与耐心',
    '天同': '温柔多情、重感觉与情调，感情甜但需防优柔或过于理想化',
    '廉贞': '感情浓烈、桃花较旺，爱恨分明，宜守住分寸、专一经营',
    '太阴': '体贴念旧、重感情细节，温柔顾家，但易敏感多感、需要安全感',
    '贪狼': '魅力足、异性缘旺，恋爱多彩，宜收敛桃花、专注一人',
    '巨门': '相处中易有口角言语摩擦，宜少计较、多体谅，沟通是关键',
    '天相': '重承诺与体面，是顾家的好伴侣，感情平稳，宜主动表达',
    '天梁': '感情中像长辈般照顾对方，偏成熟稳重，宜避免说教与代沟',
    '七杀': '爱得果断也分得干脆、个性强，宜晚婚，找能包容其冲劲的对象',
    '破军': '感情敢爱敢恨、易有波折变动，宜晚婚、珍惜眼前、避免冲动决断',
  };

  // 主星 -> 性格关键词（用于标签）
  const STAR_TAGS = {
    '紫微': ['尊贵', '领导', '好面子'], '天府': ['稳重', '守成', '包容'],
    '天机': ['机敏', '善谋', '多思'], '太阳': ['热情', '博爱', '事业心'],
    '武曲': ['刚毅', '务实', '理财'], '天同': ['温和', '享受', '随性'],
    '廉贞': ['多变', '魅力', '手腕'], '太阴': ['细腻', '内敛', '念旧'],
    '贪狼': ['多才', '交际', '欲望'], '巨门': ['口才', '钻研', '犀利'],
    '天相': ['辅佐', '体面', '协调'], '天梁': ['稳重', '荫庇', '原则'],
    '七杀': ['独立', '冲劲', '果决'], '破军': ['开创', '变动', '革新'],
  };

  // 五行局 -> 简评
  const ELEM_NOTE = {
    '水二局': '五行属水，思维灵活、适应力强，起运早（约2岁），人生节奏偏快',
    '木三局': '五行属木，生发向上、有韧性与成长力，约3岁起运',
    '金四局': '五行属金，刚毅果决、重义气与原则，约4岁起运',
    '土五局': '五行属土，敦厚稳重、踏实可靠，约5岁起运，大器偏晚成',
    '火六局': '五行属火，热情积极、行动力强，约6岁起运，人生爆发力足',
  };

  // 取某宫主星（含借对宫），并返回对应的解读片段集合
  function jpStarLines(d, palName, map) {
    const ms = pMajors(d, palName);
    return ms.filter((n) => map[n]).map((n) => ({ star: n, text: map[n] }));
  }

  // ===== 飞星四化（命宫干 / 各宫干四化 + 自化）=====
  // 十天干四化表（禄/权/科/忌 对应的星名，中文）——经 iztro mutagedPlaces() 实测校验一致
  const STEM_MUTAGEN = {
    '甲': ['廉贞', '破军', '武曲', '太阳'], '乙': ['天机', '天梁', '紫微', '太阴'],
    '丙': ['天同', '天机', '文昌', '廉贞'], '丁': ['太阴', '天同', '天机', '巨门'],
    '戊': ['贪狼', '太阴', '右弼', '天机'], '己': ['武曲', '贪狼', '天梁', '文曲'],
    '庚': ['太阳', '武曲', '太阴', '天同'], '辛': ['巨门', '太阳', '文曲', '文昌'],
    '壬': ['天梁', '紫微', '左辅', '武曲'], '癸': ['破军', '巨门', '太阴', '贪狼'],
  };
  const MUT_ORDER = ['禄', '权', '科', '忌'];

  // 某宫天干的四化「飞入」哪些本命宫（飞星）
  function flyMutagen(d, palName) {
    const p = findPalace(d, palName);
    if (!p) return [];
    const stars = STEM_MUTAGEN[p.heavenlyStem];
    if (!stars) return [];
    return stars.map((star, i) => ({
      mut: MUT_ORDER[i], star, to: natalPalaceOfStar(d, star), stem: p.heavenlyStem,
    }));
  }
  // 某宫的「自化」：该宫天干引动的四化星，恰好就坐落在本宫
  function selfMutagen(d, palName) {
    const p = findPalace(d, palName);
    if (!p) return [];
    const stars = STEM_MUTAGEN[p.heavenlyStem];
    if (!stars) return [];
    const here = new Set([...p.majorStars, ...p.minorStars, ...p.adjectiveStars].map((s) => s.name));
    const r = [];
    stars.forEach((star, i) => { if (here.has(star)) r.push({ mut: MUT_ORDER[i], star }); });
    return r;
  }

  // 主星庙旺落陷 -> 简评（结合亮度）
  function brightnessNote(b) {
    if (['庙', '旺'].includes(b)) return { tone: 'good', txt: '庙旺得地，力量充分发挥，吉者更吉' };
    if (['得', '利'].includes(b)) return { tone: 'mid', txt: '得地有力，发挥尚佳' };
    if (b === '平') return { tone: 'mid', txt: '平和，力量中平' };
    if (['不', '陷'].includes(b)) return { tone: 'tough', txt: '落陷失辉，力量受限，需后天补强' };
    return { tone: 'mid', txt: '力量中平' };
  }

  // 一颗主星的庙旺信息（在某宫里找）
  function starBrightness(d, palName, starName) {
    const p = findPalace(d, palName);
    if (!p) return '';
    const s = p.majorStars.find((x) => x.name === starName);
    return s ? (s.brightness || '') : '';
  }

  // 取某宫的辅星/煞星分类
  const LUCKY_AUX = ['左辅', '右弼', '天魁', '天钺', '文昌', '文曲', '禄存', '天马'];
  const HARSH_AUX = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫', '天空'];
  function palaceAux(d, palName) {
    const p = findPalace(d, palName);
    if (!p) return { lucky: [], harsh: [], other: [] };
    const all = [...p.minorStars, ...p.adjectiveStars].map((s) => s.name);
    return {
      lucky: all.filter((n) => LUCKY_AUX.includes(n)),
      harsh: all.filter((n) => HARSH_AUX.includes(n)),
      other: all.filter((n) => !LUCKY_AUX.includes(n) && !HARSH_AUX.includes(n)),
    };
  }

  // 增强版格局判定：返回 { name, type:'成格'|'破格'|'', desc } 数组
  function detectPatterns(d) {
    const soul = findPalace(d, '命宫');
    const ms = new Set(majorNames(soul));
    const out = [];
    const has = (n) => ms.has(n);
    // 三方四正主星集合（用于杀破狼/机月同梁/紫府等结构判断）
    const triadStars = new Set();
    ['命宫', '迁移', '财帛', '官禄'].forEach((pn) => {
      const p = findPalace(d, pn);
      if (p) majorNames(p).forEach((n) => triadStars.add(n));
    });
    const tHas = (n) => triadStars.has(n);

    // 杀破狼
    if (tHas('七杀') || tHas('破军') || tHas('贪狼')) {
      out.push({ name: '杀破狼格', type: '主格', desc: '命格三方四正见七杀、破军、贪狼，人生主轴在「变动与开创」——一生起伏较大、不安于现状，宜化冲劲为革新动力，最忌求稳守成。适合开创、业务、专业技术或自主奋斗的路。' });
    }
    // 机月同梁
    if (tHas('天机') && tHas('太阴') && tHas('天同') && tHas('天梁')) {
      out.push({ name: '机月同梁格', type: '主格', desc: '三方四正见天机、太阴、天同、天梁，主稳定、规律、智慧型的人生节奏——适合公职、行政、企划、文教、专业服务等「安稳上班 / 专业立身」的路，忌大起大落的投机冒险。' });
    }
    // 紫府
    if (has('紫微') && has('天府')) out.push({ name: '紫府同宫格', type: '成格', desc: '帝星紫微与财库天府同坐命宫，主稳重大器、兼具领导与守成之才，格局厚重，宜往管理、统筹、掌握资源的方向发展。' });
    else if (tHas('紫微') && tHas('天府')) out.push({ name: '紫府朝垣格', type: '成格', desc: '紫微、天府于三方四正拱照命宫，主一生有贵气与资源助力，行事稳健、能聚财掌权。' });
    // 日月
    if (has('太阳') && has('太阴')) out.push({ name: '日月同宫格', type: '成格', desc: '太阳太阴同临，主才华横溢、内外兼修、阴阳调和，情感与理智兼备，唯情绪起伏需调适。' });
    // 武贪
    if (has('武曲') && has('贪狼')) out.push({ name: '武贪格', type: '成格', desc: '武曲贪狼同宫，主「先勤后发、中晚年发达」，宜专业实干兼把握机遇，年轻时多积累、忌操之过急。' });
    // 机梁
    if (has('天机') && has('天梁')) out.push({ name: '机梁格', type: '成格', desc: '天机天梁同临，长于谋略、参谋、分析与化解，是智慧型、顾问型的命格，适合宗教哲学、策划、监察。' });
    // 君臣庆会（紫微 + 辅弼/昌曲魁钺）
    const soulAux = palaceAux(d, '命宫');
    if ((has('紫微') || has('天府')) && (soulAux.lucky.includes('左辅') || soulAux.lucky.includes('右弼') || soulAux.lucky.includes('文昌') || soulAux.lucky.includes('文曲'))) {
      out.push({ name: '君臣庆会', type: '成格', desc: '主星得左辅右弼或文昌文曲等吉星扶持，主有得力助手与贵人相随，事业易成气候。' });
    }
    // 破格信号：命宫见煞或主星落陷
    if (soulAux.harsh.length) {
      out.push({ name: '命宫见煞', type: '破格', desc: `命宫会照 ${soulAux.harsh.join('、')} 等煞曜，主性格或人生带有磨练与冲击，吉星力量打折扣，需以耐心与修养化解，化煞为用反能成就坚韧。` });
    }
    if (!majorNames(soul).length) {
      out.push({ name: '命无正曜', type: '', desc: '命宫无主星，借对宫迁移宫之星论命，格局灵活、可塑性高，性格易受环境影响，宜后天主动立定方向，反而海阔天空。' });
    }
    return out;
  }

  // 全盘吉凶总基调（综合三方四正四化与吉煞）
  function overallTone(d) {
    let score = 0;
    ['命宫', '迁移', '财帛', '官禄'].forEach((pn) => {
      const p = findPalace(d, pn);
      if (!p) return;
      [...p.majorStars, ...p.minorStars].forEach((s) => {
        if (s.mutagen === '禄' || s.mutagen === '权' || s.mutagen === '科') score += 1;
        if (s.mutagen === '忌') score -= 1.2;
        if (['庙', '旺'].includes(s.brightness)) score += 0.4;
        if (['陷', '不'].includes(s.brightness)) score -= 0.4;
      });
      const aux = palaceAux(d, pn);
      score += aux.lucky.length * 0.5;
      score -= aux.harsh.length * 0.5;
    });
    if (score >= 4) return { word: '吉多于凶 · 格局向上', txt: '全盘吉星与助力较多，整体基调偏向顺遂上行，宜积极进取、把握机会。' };
    if (score >= 1.5) return { word: '吉凶参半偏吉', txt: '全盘有亮点也有需经营之处，整体中上，趋吉避凶、扬长补短即可走得稳健。' };
    if (score >= -0.5) return { word: '平稳务实', txt: '全盘格局平和，无大吉亦无大凶，人生靠踏实积累、稳中求进。' };
    return { word: '挑战较多 · 宜守', txt: '全盘煞忌或落陷较多，人生磨练偏多，宜稳健保守、修身养性，以耐心化解，后天努力可明显改善先天。' };
  }

  // 生年四化按 禄权科忌 归类：{ '禄':[{star,palace}], ... }
  function mutByType(d) {
    const out = { '禄': [], '权': [], '科': [], '忌': [] };
    d.palaces.forEach((p) => {
      [...p.majorStars, ...p.minorStars].forEach((s) => {
        if (s.mutagen && out[s.mutagen]) out[s.mutagen].push({ star: s.name, palace: p.name });
      });
    });
    return out;
  }

  // 飞化「飞入某宫」的事件含义
  function flyEventNote(mut, toPal) {
    const field = PALACE_MEANING[toPal] || '相关领域';
    if (mut === '禄') return `为「${field}」带来助益、善缘与进益，是这股能量主动施惠的方向`;
    if (mut === '权') return `把掌控力与心力投注在「${field}」，主对其强势介入、积极经营`;
    if (mut === '科') return `为「${field}」带来名声、文书、贵人与逢凶化吉之力`;
    const opp = OPP_PALACE[toPal] || '';
    return `对「${field}」有放不下的牵挂、执着或耗损${opp ? `，且回冲${opp}宫，连带影响该宫人事` : ''}`;
  }

  // 把宫位 → 人生事件标签（用于流年预判）
  function palaceLifeTag(mut, pal) {
    const m = {
      '官禄': mut === '忌' ? '事业易变动/受阻' : '事业升迁·学业有成',
      '财帛': mut === '忌' ? '注意破财/投资亏损' : '进财机会·财运活络',
      '田宅': mut === '忌' ? '家宅变动/置产破耗' : '置产·家宅添喜',
      '夫妻': mut === '忌' ? '感情易生波折' : '感情升温·婚恋喜事',
      '子女': mut === '忌' ? '亲子/合伙需留意' : '添丁·桃花·创作丰收',
      '疾厄': mut === '忌' ? '健康亮黄灯·防伤病' : '体能调养见效',
      '福德': mut === '忌' ? '精神压力大·防焦虑' : '心境开阔·福分增长',
      '迁移': mut === '忌' ? '在外奔波·防意外' : '外出·搬迁·拓展有利',
      '命宫': mut === '忌' ? '自我调整·重要抉择' : '人生上台阶·能力跃升',
      '父母': mut === '忌' ? '留意长辈健康/文书' : '得长辈上司提携',
      '兄弟': mut === '忌' ? '平辈合作防摩擦' : '手足朋友得助力',
      '仆役': mut === '忌' ? '人际是非·防小人' : '人脉拓展·贵人多',
      '交友': mut === '忌' ? '人际是非·防小人' : '人脉拓展·贵人多',
    };
    return m[pal] || (mut === '忌' ? '相关领域需留意' : '相关领域有进展');
  }

  // —— Part 4 子构建：四化飞星·全盘因果逻辑 ——
  function buildFlyingStar(d) {
    const H = [];
    const mt = mutByType(d);

    // 4.1 生年四化全局解读
    H.push('<div class="jp-sub-tt">4.1　生年四化 · 先天定数</div>');
    H.push('<p class="jp-lead-sm">生年四化由你的<b>出生年天干</b>决定，是与生俱来、贯穿一生的能量主轴——禄权科是天赋助力，忌是必修功课。</p>');
    H.push('<div class="jp-mut-grid">');
    MUT_ORDER.forEach((mut) => {
      const arr = mt[mut];
      H.push(`<div class="jp-mut-col m-${mut}"><div class="jp-mut-col-h">${mutBadge(mut)} 化${mut}<em>${MUT_MEANING[mut]}</em></div>`);
      if (arr.length) {
        arr.forEach((x) => {
          const field = PALACE_MEANING[x.palace] || '';
          H.push(`<div class="jp-mut-row"><b>${x.star}</b> 落 <span class="pal-hl">${x.palace}宫</span>${field ? `<span class="jp-mut-field">${field}</span>` : ''}</div>`);
        });
      } else {
        H.push('<div class="jp-mut-row empty">本盘无此化</div>');
      }
      H.push('</div>');
    });
    H.push('</div>');
    if (mt['忌'].length) {
      H.push(`<p class="jp-warn">⚠ 你的生年化忌为 <b>${mt['忌'].map((x) => x.star + '化忌落' + x.palace + '宫').join('、')}</b>——这是此生最需要用心经营、不可回避的核心课题，遇到相关领域宜多一分谨慎与耐心。</p>`);
    }

    // 4.2 命宫干四化（后天人为选择）
    H.push('<div class="jp-sub-tt" style="margin-top:20px">4.2　命宫干四化 · 后天选择</div>');
    H.push('<p class="jp-lead-sm">命宫天干引动的四化「飞入」哪些宫位，代表<b>你主动用心、亲手促成</b>的人生因果——这是后天选择的方向。</p>');
    const soulFly = flyMutagen(d, '命宫');
    if (soulFly.length) {
      H.push('<ul class="jp-list">');
      soulFly.forEach((f) => {
        if (!f.to) return;
        H.push(`<li>${mutBadge(f.mut)} 命宫（${f.stem}干）引 <b>${f.star}</b> 化${f.mut} 飞入 <span class="pal-hl">${f.to}宫</span>——你${flyEventNote(f.mut, f.to)}。</li>`);
      });
      H.push('</ul>');
    } else {
      H.push('<p class="jp-note">命宫干四化信息从略。</p>');
    }

    // 4.3 重点宫位飞化联动
    H.push('<div class="jp-sub-tt" style="margin-top:20px">4.3　重点宫位飞化联动 · 因果链</div>');
    H.push('<p class="jp-lead-sm">财帛、官禄、夫妻、田宅四大现实宫位的天干飞化，揭示「钱、事业、感情、家业」之间牵一发动全身的因果联动。</p>');
    const keyPals = [['财帛', '钱财'], ['官禄', '事业'], ['夫妻', '婚姻'], ['田宅', '家业']];
    const linkRows = [];
    keyPals.forEach(([pn, label]) => {
      const flies = flyMutagen(d, pn);
      const lu = flies.find((f) => f.mut === '禄' && f.to);
      const ji = flies.find((f) => f.mut === '忌' && f.to);
      const segs = [];
      if (lu) segs.push(`化禄飞入<span class="pal-hl">${lu.to}宫</span>（${lu.star}）——你的${label}能为「${PALACE_MEANING[lu.to] || lu.to}」带来助力`);
      if (ji) {
        const opp = OPP_PALACE[ji.to] || '';
        segs.push(`化忌飞入<span class="pal-hl">${ji.to}宫</span>（${ji.star}）——${label}牵动「${PALACE_MEANING[ji.to] || ji.to}」的耗损${opp ? `，并冲${opp}宫` : ''}`);
      }
      if (segs.length) linkRows.push(`<li><b>${pn}宫</b>：${segs.join('；')}。</li>`);
    });
    if (linkRows.length) { H.push('<ul class="jp-list">' + linkRows.join('') + '</ul>'); }
    else H.push('<p class="jp-note">重点宫位未见显著飞化联动。</p>');

    // 4.4 自化标记（风险点单独标注）
    H.push('<div class="jp-sub-tt" style="margin-top:20px">4.4　自化标记 · 隐性风险点</div>');
    H.push('<p class="jp-lead-sm">「自化」指某宫天干引动的四化星，恰好坐在<b>本宫自己</b>——能量自我消耗、不假外求，常是命盘里容易被忽略的隐性破口。</p>');
    const selfRows = [];
    d.palaces.forEach((p) => {
      const sm = selfMutagen(d, p.name);
      sm.forEach((s) => {
        let risk;
        if (s.mut === '禄') risk = '自化禄：看似顺遂、易得意忘形，福分容易在不知不觉中流失，属「虚假利好」，宜惜福收敛';
        else if (s.mut === '忌') risk = '自化忌：自我内耗、钻牛角尖，无外力即自损，是该宫最需警惕的内在破口';
        else if (s.mut === '权') risk = '自化权：自我膨胀、过度逞强，宜收敛锋芒、避免独断';
        else risk = '自化科：自我标榜、好名重面子，宜务实低调';
        selfRows.push(`<li>${mutBadge(s.mut)} <span class="pal-hl">${p.name}宫</span> <b>${s.star}</b> 自化${s.mut}——${risk}。</li>`);
      });
    });
    if (selfRows.length) { H.push('<ul class="jp-list jp-self">' + selfRows.join('') + '</ul>'); }
    else H.push('<p class="jp-good">✦ 本盘各宫未见明显自化，能量较少自我空耗，是难得的稳定结构。</p>');

    return H.join('\n');
  }

  // —— Part 5 子构建：近10年重点流年预判 ——
  function buildYearlyForecast(d) {
    if (!state.astro || typeof state.astro.horoscope !== 'function') return '';
    const nowYear = new Date().getFullYear();
    const by = birthYear(d);
    const rows = [];
    for (let i = 0; i < 10; i++) {
      const yr = nowYear + i;
      let h;
      try { h = state.astro.horoscope(new Date(yr, 6, 1)); } catch (e) { continue; }
      if (!h || !h.yearly) continue;
      const ym = h.yearly;
      const seatPal = (ym.palaceNames && ym.palaceNames[0]) || '';
      const asp = mutagenAspects(d, ym.mutagen);
      const ji = asp.find((a) => a.mut === '忌');
      const lu = asp.find((a) => a.mut === '禄');
      const quan = asp.find((a) => a.mut === '权');
      const tags = [];
      if (lu && lu.pal) tags.push({ t: 'good', x: palaceLifeTag('禄', lu.pal) });
      if (quan && quan.pal && (!lu || quan.pal !== lu.pal)) tags.push({ t: 'good', x: palaceLifeTag('权', quan.pal) });
      if (ji && ji.pal) tags.push({ t: 'bad', x: palaceLifeTag('忌', ji.pal) });
      const tone = (ji && !lu) ? 'tough' : ((lu && !ji) ? 'good' : 'mid');
      const xu = by ? (yr - by + 1) : null;
      rows.push(`<div class="jp-yf-row ${tone}">
        <div class="jp-yf-yr">${yr}<span>${xu ? '虚岁' + xu : ''}</span></div>
        <div class="jp-yf-body">
          <div class="jp-yf-seat">流年命宫落本命 <b>${seatPal ? (/宫$/.test(seatPal) ? seatPal : seatPal + '宫') : '—'}</b></div>
          <div class="jp-yf-tags">${tags.length ? tags.map((g) => `<span class="jp-yf-tag ${g.t}">${g.x}</span>`).join('') : '<span class="jp-yf-tag mid">平顺无大起伏</span>'}</div>
        </div>
      </div>`);
    }
    if (!rows.length) return '';
    return '<div class="jp-yf">' + rows.join('') + '</div>';
  }

  function buildJiepan(d) {
    const L = [];
    const soul = findPalace(d, '命宫');
    const soulMs = pMajors(d, '命宫');
    const soulOwn = majorNames(soul);
    const borrowed = !soulOwn.length;
    const mt = mutByType(d);
    const mutFound = [];
    d.palaces.forEach((p) => {
      [...p.majorStars, ...p.minorStars].forEach((s) => { if (s.mutagen) mutFound.push({ star: s.name, mut: s.mutagen, palace: p.name }); });
    });
    const patterns = detectPatterns(d);
    const tone = overallTone(d);

    // —— 顶部定调卡 ——
    const tagPool = [];
    soulMs.forEach((n) => { if (STAR_TAGS[n]) tagPool.push(...STAR_TAGS[n]); });
    const tags = Array.from(new Set(tagPool)).slice(0, 6);
    const mainPat = patterns.find((p) => p.type === '主格') || patterns.find((p) => p.type === '成格');
    const oneLine = soulMs.length
      ? `命宫坐 <b>${soulMs.join('、')}</b>${borrowed ? '（命宫无主星，借对宫迁移宫论）' : ''}${mainPat ? `，属<b>${mainPat.name}</b>` : ''}，全盘基调「${tone.word}」。`
      : '命宫格局以对宫与三方借力为主，可塑性高。';
    L.push(`<div class="jp-hero">
      <div class="jp-hero-top">
        <span class="jp-hero-name">${d.name}</span>
        <span class="jp-hero-meta">${d.gender}命 · 生肖${d.zodiac} · ${d.fiveElementsClass}</span>
      </div>
      <div class="jp-hero-line">${oneLine}</div>
      <div class="jp-hero-tags">${tags.map((t) => `<span class="jp-tag">${t}</span>`).join('')}</div>
      <div class="jp-hero-base">命主星 <b>${d.soul}</b> · 身主星 <b>${d.body}</b> · 命宫${d.soulBranch} · 身宫${d.bodyBranch} · ${d.solarDate} ${d.time}</div>
    </div>`);

    // 目录导航（六部分）
    const toc = [
      ['s1', '一·基础档案'], ['s2', '二·先天内核'], ['s3', '三·人事拆解'],
      ['s4', '四·四化飞星'], ['s5', '五·时限运势'], ['s6', '六·综合总结'],
    ];
    L.push(`<nav class="jp-toc">${toc.map(([id, t]) => `<a href="#${id}">${t}</a>`).join('')}</nav>`);

    // ============ 第一部分：命盘基础档案 ============
    L.push(sec('s1', '一', '命盘基础档案', '出生信息、定盘校验与全局格局总评，先把「这张盘」交代清楚'));
    L.push('<div class="jp-body">');

    // 1.1 个人出生信息 + 真太阳时
    L.push('<div class="jp-sub-tt">1.1　出生信息与定盘</div>');
    L.push(`<div class="jp-archive">
      <div class="jp-arc-row"><span class="k">姓名</span><span>${d.name}</span></div>
      <div class="jp-arc-row"><span class="k">性别 / 生肖</span><span>${d.gender}命 · 属${d.zodiac} · ${d.sign}</span></div>
      <div class="jp-arc-row"><span class="k">阳历</span><span>${d.solarDate} ${d.time}</span></div>
      <div class="jp-arc-row"><span class="k">农历</span><span>${d.lunarDate}</span></div>
      <div class="jp-arc-row"><span class="k">八字四柱</span><span>${d.chineseDate}</span></div>
      <div class="jp-arc-row"><span class="k">命宫 / 身宫</span><span>命宫坐${d.soulBranch} · 身宫坐${d.bodyBranch}</span></div>
    </div>`);
    // 真太阳时换算说明
    if (state.tst && state.tst.used) {
      const t = state.tst;
      const dir = t.delta >= 0 ? '晚' : '早';
      L.push(`<p class="jp-note"><b>真太阳时换算：</b>出生地 <b>${t.city || '（按经度）'}</b>（约东经${t.lng}°），钟表时间 ${t.clock} 经经度时差与均时差校正后，真太阳时约为 <b>${t.solar}</b>（比北京时间${dir}约 ${Math.abs(t.delta)} 分钟），据此定为 <b>${t.timeName || ''}</b> 起盘——时辰交界处的盘面因此更精准。</p>`);
    } else {
      L.push('<p class="jp-note"><b>真太阳时换算：</b>本次未启用出生地校正，直接按所填钟表时辰起盘。若你出生在时辰交界附近，建议回到排盘补填出生地点以提高精度。</p>');
    }
    // 定盘校验结果
    if (state.dpScore != null) {
      const dimLabel = { d1: '性格外貌', d2: '六亲缘分', d3: '大限往事', d4: '内在际遇' };
      const dd = state.dpDetail || {};
      const passed = state.dpScore >= JIEPAN_PASS;
      L.push(`<div class="jp-dp-verify ${passed ? 'pass' : 'low'}">
        <div class="jp-dp-v-h"><span>定盘契合度校验</span><b>${state.dpScore} 分</b><em>${passed ? '盘面可信 ✓' : '契合偏低，仅供参考'}</em></div>
        <div class="jp-dp-v-dims">`);
      ['d1', 'd2', 'd3', 'd4'].forEach((dim) => {
        const o = dd[dim];
        const pct = (o && o.pct != null) ? Math.round(o.pct) : null;
        L.push(`<div class="jp-dp-v-dim"><span class="lbl">${dimLabel[dim]}</span><span class="bar"><i style="width:${pct == null ? 0 : pct}%;background:${scoreColor(pct == null ? 0 : pct)}"></i></span><span class="val">${pct == null ? '—' : pct}</span></div>`);
      });
      L.push('</div></div>');
    } else {
      L.push('<p class="jp-note">（尚未完成定盘校验。解盘结论的可信度以定盘契合度为前提，建议先完成定盘。）</p>');
    }

    // 1.2 盘核心参数
    L.push('<div class="jp-sub-tt" style="margin-top:18px">1.2　命盘核心参数</div>');
    if (ELEM_NOTE[d.fiveElementsClass]) {
      L.push(`<p><b>五行局：</b><span class="star-hl">${d.fiveElementsClass}</span>——${ELEM_NOTE[d.fiveElementsClass]}。命主星 <b>${d.soul}</b>（主先天禀赋与人生走向），身主星 <b>${d.body}</b>（主后天努力与中晚年依归）。</p>`);
    }
    // 生年四化禄权科忌落宫一览
    L.push('<p><b>生年四化落宫：</b></p><ul class="jp-list jp-mut-line">');
    MUT_ORDER.forEach((mut) => {
      const arr = mt[mut];
      L.push(`<li>${mutBadge(mut)} 化${mut}：${arr.length ? arr.map((x) => `${x.star}落${x.palace}宫`).join('、') : '本盘无'}</li>`);
    });
    L.push('</ul>');

    // 1.3 全局格局总评
    L.push('<div class="jp-sub-tt" style="margin-top:18px">1.3　全局格局总评</div>');
    if (patterns.length) {
      L.push('<div class="jp-pat-list">');
      patterns.forEach((p) => {
        const cls = p.type === '破格' ? 'pat-bad' : (p.type === '主格' ? 'pat-main' : (p.type === '成格' ? 'pat-good' : 'pat-mid'));
        L.push(`<div class="jp-pat ${cls}"><div class="jp-pat-h"><span class="jp-pat-name">${p.name}</span>${p.type ? `<span class="jp-pat-tag">${p.type}</span>` : ''}</div><div class="jp-pat-desc">${p.desc}</div></div>`);
      });
      L.push('</div>');
    } else {
      L.push('<p>本盘格局平实，无特殊成格或破格，人生靠踏实积累。</p>');
    }
    L.push(`<div class="jp-tone jp-tone-${tone.word.includes('挑战') ? 'tough' : (tone.word.includes('向上') ? 'good' : 'mid')}"><span class="jp-tone-word">${tone.word}</span><span class="jp-tone-txt">${tone.txt}</span></div>`);
    L.push('</div>');

    // ============ 第二部分：先天内核·自我全貌 ============
    L.push(sec('s2', '二', '先天内核 · 自我全貌', '命宫立身、身宫归依、福德主精神、疾厄定体质——这是先天的「你」'));
    L.push('<div class="jp-body">');

    // 2.1 命宫详解 + 三方四正联动
    L.push('<div class="jp-sub-tt">2.1　命宫详解 · 你的人格内核</div>');
    if (soulMs.length) {
      L.push(`<p>命宫坐 <span class="pal-hl">${soul.heavenlyStem}${soul.earthlyBranch}</span>，主星 ${soulMs.map((n) => `<span class="star-hl">${n}</span>`).join('、')}${borrowed ? '（命宫无正曜，借对宫迁移宫之星论命）' : ''}：</p>`);
      L.push('<ul class="jp-list">');
      soulMs.forEach((n) => {
        const b = soulOwn.includes(n) ? starBrightness(d, '命宫', n) : '';
        const bn = b ? brightnessNote(b) : null;
        L.push(`<li><b>${n}</b>${b ? `<span class="rd-bright">${b}</span>` : ''}：${STAR_TRAITS[n] || ''}。${STAR_PERSONA[n] ? '<br><span class="jp-dim">外在表现：' + STAR_PERSONA[n] + '</span>' : ''}${bn ? `<br><span class="jp-dim jp-b-${bn.tone}">庙旺落陷：${bn.txt}。</span>` : ''}</li>`);
      });
      L.push('</ul>');
    } else {
      L.push('<p>命宫无主星，性格灵活善变、易受环境与身边人影响，需靠后天主动确立方向。此类命格反而格局开阔、可塑性高。</p>');
    }
    // 命宫辅煞
    const soulAux = palaceAux(d, '命宫');
    if (soulAux.lucky.length || soulAux.harsh.length) {
      L.push(`<p class="jp-note"><b>辅煞配置：</b>${soulAux.lucky.length ? '吉星 <b class="t-good">' + soulAux.lucky.join('、') + '</b> 增辉助力' : ''}${soulAux.lucky.length && soulAux.harsh.length ? '；' : ''}${soulAux.harsh.length ? '煞星 <b class="t-bad">' + soulAux.harsh.join('、') + '</b> 带来磨练与冲击，吉星力量打折，需以耐心化解' : ''}。</p>`);
    }
    // 三方四正联动
    const triParts = [];
    ['迁移', '财帛', '官禄'].forEach((pn) => {
      const ms = pMajors(d, pn);
      if (ms.length) triParts.push(`${pn}宫（${ms.join('、')}）`);
    });
    L.push(`<p class="jp-note"><b>三方四正联动：</b>命宫不孤论，须合参 ${triParts.join('、') || '迁移/财帛/官禄三方'}。${mainPat ? `三方组合成「${mainPat.name}」，${mainPat.desc}` : '三方星情共同决定你处世、求财、立业的整体格局。'}</p>`);
    // 天赋与短板
    const giftWords = Array.from(new Set(tagPool)).slice(0, 5);
    const jiInTri = mutFound.filter((m) => m.mut === '忌' && ['命宫', '迁移', '财帛', '官禄'].includes(m.palace));
    L.push(`<p><b>天赋长板：</b>${giftWords.length ? giftWords.join('、') : '务实稳健'}。<b style="margin-left:8px">先天短板：</b>${soulAux.harsh.length ? '命宫会照' + soulAux.harsh.join('、') + '，性格易冲动或带磨练；' : ''}${jiInTri.length ? '三方见' + jiInTri.map((m) => m.star + '化忌（' + m.palace + '宫）').join('、') + '，相关领域需多用心；' : ''}${(!soulAux.harsh.length && !jiInTri.length) ? '无明显硬伤，整体均衡，宜专注发挥长处。' : '宜以修养与耐心化解，化煞为用。'}</p>`);

    // 2.2 身宫
    L.push('<div class="jp-sub-tt" style="margin-top:18px">2.2　身宫 · 后半生的依归</div>');
    const bodyP = d.palaces.find((p) => p.isBodyPalace);
    if (bodyP) {
      const bms = majorNames(bodyP).length ? majorNames(bodyP) : pMajors(d, bodyP.name);
      L.push(`<p>身宫与<b>${/宫$/.test(bodyP.name) ? bodyP.name : bodyP.name + '宫'}</b>同宫（${PALACE_MEANING[bodyP.name] || ''}），主星 ${bms.length ? bms.join('、') : '借对宫'}。身宫代表<b>35岁后逐渐显现、后半生着力经营的方向</b>——你中晚年的重心与归属，会越来越向这个宫位所主的人生领域靠拢。${bms.some((n) => STAR_TRAITS[n]) ? '其中 ' + bms.filter((n) => STAR_TRAITS[n]).map((n) => n + '（' + STAR_TRAITS[n].split('，')[0] + '）').join('、') + ' 的特质会在后半生更突出。' : ''}</p>`);
    } else {
      L.push('<p>身宫信息从略。</p>');
    }

    // 2.3 福德宫
    L.push('<div class="jp-sub-tt" style="margin-top:18px">2.3　福德宫 · 精神与福气根基</div>');
    const fude = pMajors(d, '福德');
    const fudeP = findPalace(d, '福德');
    const fudeMut = fudeP ? [...fudeP.majorStars, ...fudeP.minorStars].filter((s) => s.mutagen).map((s) => s.name + '化' + s.mutagen) : [];
    L.push(`<p>${fude.length ? '福德宫主星为 ' + fude.map((n) => `<span class="star-hl">${n}</span>`).join('、') + '。' : '福德宫借对宫论。'}${auxClaim('福德', fude, fudeMut)}你的兴趣、品味、精神享受与抗压能力多由此而来——福德安定者心宽福厚，福德见忌煞者则需主动调心、培养寄托。</p>`);

    // 2.4 疾厄宫
    L.push('<div class="jp-sub-tt" style="margin-top:18px">2.4　疾厄宫 · 先天体质底层</div>');
    const jiMs = pMajors(d, '疾厄');
    const jiP = findPalace(d, '疾厄');
    const jiMut = jiP ? [...jiP.majorStars, ...jiP.minorStars].filter((s) => s.mutagen).map((s) => s.name + '化' + s.mutagen) : [];
    L.push(`<p>${auxClaim('疾厄', jiMs, jiMut)}</p>`);
    L.push('<p class="jp-note">提醒：命理仅作体质倾向参考，不能替代医学诊断，身体不适请及时就医。</p>');
    L.push('</div>');

    // ============ 第三部分：十二宫人事专项拆解 ============
    L.push(sec('s3', '三', '十二宫人事专项拆解', '分三大板块——三合看静态格局，四化看动态因果'));
    L.push('<div class="jp-body">');

    // 3.1 亲缘六亲板块
    L.push('<div class="jp-sub-tt">3.1　亲缘六亲板块</div>');
    L.push('<ul class="jp-list">');
    [['父母', '父母长辈'], ['兄弟', '兄弟手足'], ['夫妻', '婚姻配偶'], ['子女', '子女缘分']].forEach(([pn, label]) => {
      const ms = pMajors(d, pn);
      const p = findPalace(d, pn);
      const muts = p ? [...p.majorStars, ...p.minorStars].filter((s) => s.mutagen).map((s) => s.name + '化' + s.mutagen) : [];
      const fl = flyMutagen(d, pn).filter((f) => f.to && (f.mut === '禄' || f.mut === '忌'));
      const flTxt = fl.length ? ` <span class="jp-dim">飞星：${fl.map((f) => f.star + '化' + f.mut + '入' + f.to + '宫').join('、')}。</span>` : '';
      L.push(`<li><b>${label}（${pn}宫）：</b>主星 ${ms.length ? ms.join('、') : '借对宫'}${muts.length ? '，引动 ' + muts.join('、') : ''}。${kinClaim(pn, ms, muts)}${flTxt}</li>`);
    });
    L.push('</ul>');

    // 3.2 财富事业板块
    L.push('<div class="jp-sub-tt" style="margin-top:18px">3.2　财富事业板块</div>');
    // 官禄
    const guan = pMajors(d, '官禄');
    const guanP = findPalace(d, '官禄');
    const guanMut = guanP ? [...guanP.majorStars, ...guanP.minorStars].filter((s) => s.mutagen).map((s) => s.name + '化' + s.mutagen) : [];
    L.push(`<p><b>事业（官禄宫）：</b>主星 ${guan.length ? guan.map((n) => `<span class="star-hl">${n}</span>`).join('、') : '借对宫论'}${guanMut.length ? `，引动 ${guanMut.join('、')}` : ''}。</p>`);
    const careers = guan.filter((n) => STAR_CAREER[n]);
    if (careers.length) {
      L.push('<div class="jp-cards">');
      careers.forEach((n) => {
        const c = STAR_CAREER[n];
        L.push(`<div class="jp-card"><div class="jp-card-h"><span class="star-hl">${n}</span> 型事业</div><div class="jp-card-row"><span class="k">特质</span><span>${c.style}</span></div><div class="jp-card-row"><span class="k">适合领域</span><span>${c.field}</span></div><div class="jp-card-row"><span class="k">建议</span><span>${c.tip}</span></div></div>`);
      });
      L.push('</div>');
    }
    if (guanMut.some((m) => m.endsWith('忌'))) L.push('<p class="jp-warn">⚠ 官禄宫见化忌，事业上易有反复或波动，宜专精一行、稳健经营。</p>');
    // 财帛
    const cai = jpStarLines(d, '财帛', STAR_WEALTH);
    const caiP = findPalace(d, '财帛');
    const caiMut = caiP ? [...caiP.majorStars, ...caiP.minorStars].filter((s) => s.mutagen).map((s) => s.name + '化' + s.mutagen) : [];
    L.push(`<p><b>财帛宫（赚钱方式）：</b></p>`);
    if (cai.length) { L.push('<ul class="jp-list">'); cai.forEach((x) => L.push(`<li><b>${x.star}</b>：${x.text}。</li>`)); L.push('</ul>'); }
    else L.push('<p>财帛宫无主星，财源随三方借力，宜建立稳定开源与储蓄纪律。</p>');
    if (caiMut.length) {
      const lu = caiMut.find((m) => m.endsWith('禄')); const ji = caiMut.find((m) => m.endsWith('忌'));
      if (lu) L.push(`<p class="jp-good">✦ 财帛宫见 ${lu}，财源活络、有进财机会。</p>`);
      if (ji) L.push(`<p class="jp-warn">⚠ 财帛宫见 ${ji}，钱财上易执着或破耗，宜量入为出。</p>`);
    }
    // 田宅 + 迁移
    const tian = pMajors(d, '田宅');
    L.push(`<p><b>田宅宫（守财与家业）：</b>主星 ${tian.length ? tian.join('、') : '借对宫论'}。田宅是财富的最终归宿，${tian.some((n) => ['天府', '太阴', '武曲'].includes(n)) ? '你田宅星情偏稳，较能守住资产、宜以不动产积累财富' : '宜有意识地把流动财转为固定资产，强化置产与储蓄'}。</p>`);
    const qian = pMajors(d, '迁移');
    const qianP = findPalace(d, '迁移');
    const qianMut = qianP ? [...qianP.majorStars, ...qianP.minorStars].filter((s) => s.mutagen).map((s) => s.name + '化' + s.mutagen) : [];
    L.push(`<p><b>迁移宫（外出际遇）：</b>主星 ${qian.length ? qian.join('、') : '借对宫论'}。${auxClaim('迁移', qian, qianMut)}</p>`);

    // 3.3 交友宫
    L.push('<div class="jp-sub-tt" style="margin-top:18px">3.3　交友宫 · 人际圈层</div>');
    const pu = findPalace(d, '仆役') || findPalace(d, '交友');
    if (pu) {
      const pms = majorNames(pu).length ? majorNames(pu) : [];
      const puMut = [...pu.majorStars, ...pu.minorStars].filter((s) => s.mutagen).map((s) => s.name + '化' + s.mutagen);
      const hasJi = puMut.some((m) => m.endsWith('忌'));
      L.push(`<p>交友宫（仆役宫）主星 ${pms.length ? pms.join('、') : '借对宫'}${puMut.length ? '，引动 ' + puMut.join('、') : ''}。${hasJi ? '你的人际圈中容易遇到是非、被拖累或交浅言深，择友宜慎，合作前先看清人品。' : (pms.some((n) => ['天府', '天同', '天梁'].includes(n)) ? '你的朋友、下属多能成为助力，人脉是你的资源，宜真诚经营。' : '你的人际关系平和，朋友圈以平淡交往为主，益友损友皆有，重在主动筛选。')}</p>`);
    } else {
      L.push('<p>交友宫信息从略。</p>');
    }
    L.push('</div>');

    // ============ 第四部分：四化飞星·全盘因果逻辑 ============
    L.push(sec('s4', '四', '四化飞星 · 全盘因果逻辑', '生年四化定先天，命宫干四化定后天，飞化联动与自化揭示牵一发动全身的因果'));
    L.push('<div class="jp-body">');
    L.push(buildFlyingStar(d));
    L.push('</div>');

    // ============ 第五部分：时限运势推演 ============
    L.push(sec('s5', '五', '时限运势推演', '大限分十年、流年看当下——人生节奏的时间地图'));
    L.push('<div class="jp-body">');
    // 5.1 当前运程聚焦
    const nowFortune = buildCurrentFortune(d);
    if (nowFortune) {
      L.push('<div class="jp-sub-tt">5.1　当前运程聚焦 · 大限 × 流年</div>');
      L.push(nowFortune);
    }
    // 5.2 大限十年分段
    L.push('<div class="jp-sub-tt" style="margin-top:20px">5.2　大限十年分段</div>');
    L.push(buildDecadalTimeline(d));
    // 5.3 近10年重点流年预判
    const yf = buildYearlyForecast(d);
    if (yf) {
      L.push('<div class="jp-sub-tt" style="margin-top:20px">5.3　近10年重点流年预判</div>');
      L.push('<p class="jp-lead-sm">依流年四化落本命宫推演，标注感情、事业、破财、健康等高发年份——红色为需留意、绿色为机会窗口。</p>');
      L.push(yf);
    }
    // 5.4 流月参考
    L.push('<div class="jp-sub-tt" style="margin-top:20px">5.4　流月简易参考</div>');
    L.push('<p class="jp-note">流月运势在流年基础上层层细分：临近的<b>关键年份</b>（上方标红或标绿者），建议进一步结合流月细看——通常流年化忌所冲之月、与流年命宫相同地支之月，是当年最需留意或最值得把握的月份。日常决策以大限、流年为主即可，不必过度纠结流月细节。</p>');
    L.push('</div>');

    // ============ 第六部分：综合总结 + 落地趋吉避凶方案 ============
    L.push(sec('s6', '六', '综合总结 + 趋吉避凶方案', '把整张盘收束成一份可执行的人生行动指南'));
    L.push('<div class="jp-body">');
    // 6.1 优势天赋 / 6.2 核心短板
    const strengths = [];
    soulMs.forEach((n) => { if (STAR_TAGS[n]) strengths.push(...STAR_TAGS[n]); });
    const goodMut = mutFound.filter((m) => m.mut !== '忌');
    const jiMutAll = mutFound.filter((m) => m.mut === '忌');
    L.push(`<div class="jp-adv jp-adv-good"><div class="jp-adv-t">6.1　全盘优势天赋</div><p>你天生具备 <b>${Array.from(new Set(strengths)).slice(0, 5).join('、') || '务实稳健'}</b> 等特质。${goodMut.length ? '生年 ' + goodMut.map((m) => m.star + '化' + m.mut).join('、') + ' 落在 ' + Array.from(new Set(goodMut.map((m) => m.palace + '宫'))).join('、') + '，是你最容易出成果的领域，宜重点投入、把长板做到极致。' : '宜认清自身长处，专注发挥，把一两件事做深做透。'}${mainPat ? '主格局「' + mainPat.name + '」是你立身的根本优势。' : ''}</p></div>`);
    L.push(`<div class="jp-adv jp-adv-warn"><div class="jp-adv-t">6.2　终身核心短板 · 人生陷阱</div><p>${jiMutAll.length ? '生年 ' + jiMutAll.map((m) => m.star + '化忌').join('、') + ' 落在 ' + Array.from(new Set(jiMutAll.map((m) => m.palace + '宫'))).join('、') + '，是你此生不可回避的功课——遇到相关领域宜多一分谨慎与耐心，化执着为修炼。' : '你的命盘没有明显硬伤，整体较均衡，保持平常心、稳健前行即可。'}${soulAux.harsh.length ? '另命宫会照 ' + soulAux.harsh.join('、') + '，性格中带有冲动或磨练，是最易绊倒自己的内在陷阱，宜以修养自律化解。' : ''}</p></div>`);

    // 6.3 分维度实操建议
    L.push('<div class="jp-sub-tt" style="margin-top:8px">6.3　分维度实操建议</div>');
    L.push('<div class="jp-plan">');
    // 事业
    L.push(`<div class="jp-plan-item"><span class="jp-plan-k">事业</span><span class="jp-plan-v">${careers.length ? '走 <b>' + careers.join('、') + '</b> 型路线：' + STAR_CAREER[careers[0]].tip + '。' : '宜专精一门、稳健积累。'}${guanMut.some((m) => m.endsWith('忌')) ? '官禄见忌，避免频繁转行。' : ''}</span></div>`);
    // 财运
    L.push(`<div class="jp-plan-item"><span class="jp-plan-k">财运</span><span class="jp-plan-v">${cai.length ? cai[0].text + '；' : ''}${caiMut.find((m) => m.endsWith('忌')) ? '财帛见忌，量入为出、分散风险、远离高杠杆。' : '建立强制储蓄，把流动财逐步转为不动产固化。'}</span></div>`);
    // 感情
    const loveLines = jpStarLines(d, '夫妻', STAR_LOVE);
    const fuMs2 = pMajors(d, '夫妻');
    const fuP2 = findPalace(d, '夫妻');
    const fuMut2 = fuP2 ? [...fuP2.majorStars, ...fuP2.minorStars].filter((s) => s.mutagen).map((s) => s.name + '化' + s.mutagen) : [];
    L.push(`<div class="jp-plan-item"><span class="jp-plan-k">感情</span><span class="jp-plan-v">${loveLines.length ? loveLines[0].text + '；' : ''}${kinClaim('夫妻', fuMs2, fuMut2)}</span></div>`);
    // 健康
    L.push(`<div class="jp-plan-item"><span class="jp-plan-k">健康</span><span class="jp-plan-v">${auxClaim('疾厄', jiMs, jiMut)}建议作息规律、定期体检，针对薄弱部位提前养护。</span></div>`);
    // 人际
    L.push(`<div class="jp-plan-item"><span class="jp-plan-k">人际</span><span class="jp-plan-v">${(function () { const pp = findPalace(d, '仆役') || findPalace(d, '交友'); const pm = pp ? [...pp.majorStars, ...pp.minorStars].filter((s) => s.mutagen).map((s) => s.name + '化' + s.mutagen) : []; return pm.some((m) => m.endsWith('忌')) ? '交友宫见忌，择友宜慎、合作先看人品，防是非小人。' : '真诚经营人脉，贵人多在平时积累，主动筛选益友。'; })()}</span></div>`);
    L.push('</div>');

    // 理性结语
    L.push(`<div class="jp-adv jp-adv-tip"><div class="jp-adv-t">理性结语</div><p>命盘只是底色，真正决定人生的是你的选择与努力。这份解读基于「三方四正合参 + 飞星四化推因果」的传统方法自动生成，旨在帮你<b>认识自己、扬长避短</b>，而非框定命运。${tone.word.includes('挑战') ? '纵有磨练，后天的努力与修养足以明显改善先天格局。' : '把先天优势用足、把功课做扎实，便能走出一条踏实而精彩的路。'}愿你把它当作一面认识自己的镜子，而非束缚自己的标签。</p></div>`);
    L.push('</div>');

    // 免责
    L.push(`<div class="jp-disclaimer">说明：本解盘基于命宫、三方四正、各宫主星、生年四化与飞星四化的传统含义自动生成，遵循「单星不论命、需合参三方四正」的原则，仅供文化娱乐与自我认识参考，<b>不构成对健康、寿命、婚姻、财富等的预测或决定性结论</b>。人生由后天努力与选择共同书写，命盘只是认识自己的一面镜子。重大决策请理性判断，健康问题请咨询专业医师。</div>`);

    return L.join('\n');
  }

  // 区块标题
  function sec(id, no, title, sub) {
    return `<div class="jp-sec" id="${id}">
      <span class="jp-sec-no">${no}</span>
      <div class="jp-sec-tt"><h3>${title}</h3><p>${sub}</p></div>
    </div>`;
  }

  // 命盘格局粗评（用于定调与命格总论）
  function gradeWord(d) {
    const soul = findPalace(d, '命宫');
    const ms = majorNames(soul);
    let score = 0;
    if (ms.length) score += 1;
    // 三方四正吉星
    ['命宫', '迁移', '财帛', '官禄'].forEach((pn) => {
      const p = findPalace(d, pn);
      if (!p) return;
      [...p.majorStars, ...p.minorStars].forEach((s) => {
        if (s.mutagen === '禄' || s.mutagen === '权' || s.mutagen === '科') score += 1;
        if (s.mutagen === '忌') score -= 1;
        if (['左辅', '右弼', '天魁', '天钺', '文昌', '文曲'].includes(s.name)) score += 0.5;
      });
    });
    if (score >= 4) return '格局开阔、助力深厚';
    if (score >= 2) return '中上而有亮点';
    if (score >= 0.5) return '平稳务实';
    return '需靠后天努力开创';
  }

  // 格局检测（常见格局简判）
  function detectPattern(d) {
    const soul = findPalace(d, '命宫');
    const ms = new Set(majorNames(soul));
    const out = [];
    if (ms.has('紫微') && ms.has('天府')) out.push('「紫府同宫」——帝星与财库同坐，主稳重大器、领导兼守成之才。');
    else if (ms.has('紫微')) out.push('命坐帝星紫微，主尊贵、有领导格局。');
    if (ms.has('武曲') && ms.has('贪狼')) out.push('「武贪格」——主中晚年发达，宜专业实干兼把握机遇。');
    if (ms.has('太阳') && ms.has('太阴')) out.push('日月并明，主才华横溢、内外兼修。');
    if (ms.has('七杀') && ms.has('破军')) out.push('杀破之气重，主开创力强、人生多变动起伏，宜将冲劲化为革新动力。');
    if (ms.has('天机') && ms.has('天梁')) out.push('「机梁善谈兵」——长于谋略、参谋与化解，适合智慧型事业。');
    if (!majorNames(soul).length) out.push('命宫无主星，格局灵活、可塑性高，宜借三方四正之力立定方向。');
    return out.length ? out.join(' ') : '';
  }

  // 大限时间轴
  function buildDecadalTimeline(d) {
    const age = approxAge(d);
    const by = birthYear(d);
    const decadals = d.palaces
      .filter((p) => p.decadal && p.decadal.range && Array.isArray(p.decadal.range))
      .map((p) => ({ pal: p, start: p.decadal.range[0], end: p.decadal.range[1] }))
      .sort((a, b) => a.start - b.start);
    if (!decadals.length) return '<p>本盘大限信息从略。</p>';
    let html = '<div class="jp-timeline">';
    decadals.forEach((dec) => {
      const pal = dec.pal;
      const ms = majorNames(pal).length ? majorNames(pal) : pMajors(d, pal.name);
      const muts = [...pal.majorStars, ...pal.minorStars].filter((s) => s.mutagen).map((s) => s.name + '化' + s.mutagen);
      const claim = decadalClaim(pal.name, muts);
      const hasJi = muts.some((m) => m.endsWith('忌'));
      const hasGood = muts.some((m) => m.endsWith('禄') || m.endsWith('权') || m.endsWith('科'));
      const tone = hasGood && !hasJi ? 'good' : (hasJi && !hasGood ? 'tough' : 'mid');
      const toneTxt = tone === 'good' ? '顺' : (tone === 'tough' ? '宜守' : '平');
      const yrSpan = by ? `${by + dec.start - 1}–${by + dec.end - 1}年` : '';
      const isCurrent = age && age >= dec.start && age <= dec.end;
      const past = age && dec.end < age;
      const cls = ['jp-tl-item', tone];
      if (isCurrent) cls.push('current');
      if (!past && !isCurrent) cls.push('future');
      html += `<div class="${cls.join(' ')}">
        <div class="jp-tl-age">${dec.start}–${dec.end}岁${isCurrent ? '<span class="jp-tl-now">当前</span>' : ''}</div>
        <div class="jp-tl-main">
          <div class="jp-tl-head"><span class="jp-tl-pal">${/宫$/.test(pal.name) ? pal.name : pal.name + '宫'}</span><span class="jp-tl-stars">${ms.length ? ms.join('·') : '无主星'}</span>${muts.length ? `<span class="jp-tl-mut">${muts.join('·')}</span>` : ''}<span class="jp-tl-tone t-${tone}">${toneTxt}</span></div>
          <div class="jp-tl-claim">${claim}</div>
          <div class="jp-tl-yr">${yrSpan}</div>
        </div>
      </div>`;
    });
    html += '</div>';
    return html;
  }

  // 在本命十二宫里定位某颗星所在的宫名
  function natalPalaceOfStar(d, starName) {
    if (!starName) return '';
    const p = d.palaces.find((pp) => [...pp.majorStars, ...pp.minorStars, ...pp.adjectiveStars]
      .some((s) => s.name === starName));
    return p ? p.name : '';
  }

  // 把一组运限四化（[禄,权,科,忌] 星名数组）定位回本命宫，生成「领域 × 吉凶」提示
  function mutagenAspects(d, mutArr) {
    const order = ['禄', '权', '科', '忌'];
    const items = [];
    (mutArr || []).forEach((star, i) => {
      if (!star) return;
      const mut = order[i];
      const pal = natalPalaceOfStar(d, star);
      const field = (pal && PALACE_MEANING[pal]) ? PALACE_MEANING[pal] : '相关领域';
      let tip;
      if (mut === '禄') tip = `${field}方面有财禄、机会与顺遂的牵引，是这段时间最值得投入、最容易出成果的方向。`;
      else if (mut === '权') tip = `${field}方面话语权与掌控力增强，宜主动出击、承担更大责任，但忌过于强势。`;
      else if (mut === '科') tip = `${field}方面利名声、文书、考试与贵人相助，遇阻时也较易逢凶化吉。`;
      else tip = `${field}方面易有阻滞、执着或耗损，是这段时间最需要耐心经营、谨慎决策、避免冲动的地方。`;
      items.push({ mut: mut, star: star, pal: pal, tip: tip });
    });
    return items;
  }

  // 按四化落宫，归纳「事业/财富/感情/健康/人际家庭」几个方面的综合提示
  function fortuneSummaryByLife(aspects) {
    const map = {
      '事业': ['官禄', '命宫', '迁移'],
      '财富': ['财帛', '田宅'],
      '感情': ['夫妻', '子女'],
      '健康情绪': ['疾厄', '福德'],
      '人际家庭': ['兄弟', '仆役', '交友', '父母'],
    };
    const out = [];
    Object.keys(map).forEach((life) => {
      const hit = aspects.filter((a) => map[life].includes(a.pal));
      if (!hit.length) return;
      const good = hit.filter((a) => a.mut !== '忌').map((a) => '化' + a.mut);
      const bad = hit.filter((a) => a.mut === '忌').map((a) => '化' + a.mut);
      let txt = '';
      if (good.length && bad.length) txt = `机会与挑战并存（${good.concat(bad).join('、')}），有亮点也有需留意处，宜趋吉避凶。`;
      else if (good.length) txt = `偏顺（${good.join('、')}），可重点把握、积极推进。`;
      else txt = `偏谨慎（${bad.join('、')}），宜稳守、缓行，避免大动作。`;
      out.push({ life: life, txt: txt });
    });
    return out;
  }

  // 当前运程聚焦：当前十年大限 + 当前流年（多维度提示）
  function buildCurrentFortune(d) {
    let h;
    try {
      if (!state.astro || typeof state.astro.horoscope !== 'function') return '';
      h = state.astro.horoscope(new Date());
    } catch (e) { return ''; }
    if (!h) return '';

    const age = approxAge(d);
    const by = birthYear(d);
    const nowYear = new Date().getFullYear();
    const parts = [];

    // —— 当前十年大限 ——
    if (h.decadal) {
      const dm = h.decadal;
      const seatPal = (dm.palaceNames && dm.palaceNames[0]) || '';
      const seatMean = (seatPal && PALACE_MEANING[seatPal]) ? PALACE_MEANING[seatPal] : '';
      // 大限年龄/年份区间：从命盘大限信息里取与当前虚岁匹配的一段
      let ageRange = '', yrRange = '';
      const decs = d.palaces
        .filter((p) => p.decadal && p.decadal.range && Array.isArray(p.decadal.range))
        .map((p) => ({ start: p.decadal.range[0], end: p.decadal.range[1] }));
      const cur = age ? decs.find((x) => age >= x.start && age <= x.end) : null;
      if (cur) {
        ageRange = `${cur.start}–${cur.end}岁`;
        if (by) yrRange = `${by + cur.start - 1}–${by + cur.end - 1}年`;
      }
      const asp = mutagenAspects(d, dm.mutagen);
      const lifeSum = fortuneSummaryByLife(asp);
      const hasJi = asp.some((a) => a.mut === '忌');
      const hasGood = asp.some((a) => a.mut !== '忌');
      const tone = hasGood && !hasJi ? 'good' : (hasJi && !hasGood ? 'tough' : 'mid');
      const toneTxt = tone === 'good' ? '整体偏顺' : (tone === 'tough' ? '宜守为主' : '机会与挑战并存');

      let html = `<div class="jp-fortune jp-f-${tone}">`;
      html += `<div class="jp-f-head"><span class="jp-f-badge">大限</span><span class="jp-f-range">${ageRange || '当前十年'}${yrRange ? ' · ' + yrRange : ''}</span><span class="jp-f-tone t-${tone}">${toneTxt}</span></div>`;
      if (seatPal) html += `<p class="jp-f-lead">这十年大限的命宫，坐落在你本命的 <b>${/宫$/.test(seatPal) ? seatPal : seatPal + '宫'}</b>${seatMean ? `（${seatMean}）` : ''}——这是本阶段的人生主轴所在。</p>`;
      if (asp.length) {
        html += '<div class="jp-f-muts">';
        asp.forEach((a) => {
          html += `<div class="jp-f-mut m-${a.mut}">${mutBadge(a.mut)} <b>${a.star}</b> 化${a.mut} 落 <span class="pal-hl">${a.pal ? (/宫$/.test(a.pal) ? a.pal : a.pal + '宫') : '运盘'}</span>：${a.tip}</div>`;
        });
        html += '</div>';
      }
      if (lifeSum.length) {
        html += '<div class="jp-f-life">';
        lifeSum.forEach((s) => { html += `<div class="jp-f-life-item"><span class="jp-f-life-k">${s.life}</span><span class="jp-f-life-v">${s.txt}</span></div>`; });
        html += '</div>';
      }
      html += '</div>';
      parts.push(html);
    }

    // —— 当前流年 ——
    if (h.yearly) {
      const ym = h.yearly;
      const seatPal = (ym.palaceNames && ym.palaceNames[0]) || '';
      const seatMean = (seatPal && PALACE_MEANING[seatPal]) ? PALACE_MEANING[seatPal] : '';
      const asp = mutagenAspects(d, ym.mutagen);
      const lifeSum = fortuneSummaryByLife(asp);
      const hasJi = asp.some((a) => a.mut === '忌');
      const hasGood = asp.some((a) => a.mut !== '忌');
      const tone = hasGood && !hasJi ? 'good' : (hasJi && !hasGood ? 'tough' : 'mid');
      const toneTxt = tone === 'good' ? '整体偏顺' : (tone === 'tough' ? '宜守为主' : '机会与挑战并存');

      // 流年吉星/煞星落宫
      const luckyNames = ['流昌', '流曲', '流魁', '流钺', '流禄', '流马', '流鸾', '流喜'];
      const harshNames = ['流羊', '流陀'];
      const lucky = [], harsh = [];
      if (Array.isArray(ym.stars) && ym.palaceNames) {
        ym.stars.forEach((arr, i) => {
          (arr || []).forEach((s) => {
            const seg = { '流禄': '财禄', '流昌': '文昌利学业文书', '流曲': '才艺口才', '流魁': '贵人(长辈/男性)', '流钺': '贵人(平辈/女性)', '流马': '走动变迁', '流鸾': '桃花姻缘', '流喜': '喜庆添丁', '流羊': '冲突意外、宜防破财口舌', '流陀': '拖延纠缠、宜防暗损' };
            const where = ym.palaceNames[i];
            if (luckyNames.includes(s.name)) lucky.push(`${seg[s.name] || s.name}（落${where}）`);
            else if (harshNames.includes(s.name)) harsh.push(`${seg[s.name] || s.name}（落${where}）`);
          });
        });
      }

      let html = `<div class="jp-fortune jp-f-${tone}">`;
      html += `<div class="jp-f-head"><span class="jp-f-badge year">流年</span><span class="jp-f-range">${nowYear}年${age ? ' · 虚岁约' + age : ''}</span><span class="jp-f-tone t-${tone}">${toneTxt}</span></div>`;
      if (seatPal) html += `<p class="jp-f-lead">今年的流年命宫，落在你本命的 <b>${/宫$/.test(seatPal) ? seatPal : seatPal + '宫'}</b>${seatMean ? `（${seatMean}）` : ''}——这是今年运势的重心。</p>`;
      if (asp.length) {
        html += '<div class="jp-f-muts">';
        asp.forEach((a) => {
          html += `<div class="jp-f-mut m-${a.mut}">${mutBadge(a.mut)} <b>${a.star}</b> 化${a.mut} 落 <span class="pal-hl">${a.pal ? (/宫$/.test(a.pal) ? a.pal : a.pal + '宫') : '运盘'}</span>：${a.tip}</div>`;
        });
        html += '</div>';
      }
      if (lucky.length || harsh.length) {
        html += '<div class="jp-f-stars">';
        if (lucky.length) html += `<div class="jp-f-star good"><b>今年助力：</b>${lucky.join('；')}。</div>`;
        if (harsh.length) html += `<div class="jp-f-star bad"><b>今年留意：</b>${harsh.join('；')}。</div>`;
        html += '</div>';
      }
      if (lifeSum.length) {
        html += '<div class="jp-f-life">';
        lifeSum.forEach((s) => { html += `<div class="jp-f-life-item"><span class="jp-f-life-k">${s.life}</span><span class="jp-f-life-v">${s.txt}</span></div>`; });
        html += '</div>';
      }
      html += '</div>';
      parts.push(html);
    }

    if (!parts.length) return '';
    parts.push('<p class="jp-f-foot">说明：以上为当前大限与流年的运程聚焦，依「运限四化落本命宫」与「流年吉煞星落宫」推演，供把握当下节奏参考；运限层层叠加，临界年份建议结合流月细看。</p>');
    return parts.join('\n');
  }

  // 综合建议（扬长避短）
  function buildAdvice(d, soulMs, mutFound) {
    const adv = [];
    // 优势：来自命宫主星 + 化禄化权化科
    const strengths = [];
    soulMs.forEach((n) => { if (STAR_TAGS[n]) strengths.push(...STAR_TAGS[n]); });
    const goodMut = mutFound.filter((m) => m.mut !== '忌');
    const jiMut = mutFound.filter((m) => m.mut === '忌');
    adv.push(`<div class="jp-adv jp-adv-good"><div class="jp-adv-t">扬长 · 你的天赋优势</div><p>你天生具备 <b>${Array.from(new Set(strengths)).slice(0, 5).join('、') || '务实稳健'}</b> 等特质。${goodMut.length ? '生年' + goodMut.map((m) => m.star + '化' + m.mut).join('、') + ' 落在' + Array.from(new Set(goodMut.map((m) => m.palace + '宫'))).join('、') + '，是你最容易出成果的领域，宜重点投入、把长板做到极致。' : '宜认清自身长处，专注发挥，把一两件事做深做透。'}</p></div>`);
    adv.push(`<div class="jp-adv jp-adv-warn"><div class="jp-adv-t">避短 · 需要经营的功课</div><p>${jiMut.length ? '生年' + jiMut.map((m) => m.star + '化忌').join('、') + ' 落在 ' + Array.from(new Set(jiMut.map((m) => m.palace + '宫'))).join('、') + '，是你此生需要格外用心、不可回避的功课——遇到相关领域宜多一分谨慎与耐心，化执着为修炼。' : '你的命盘没有明显的硬伤，整体较为均衡，保持平常心、稳健前行即可。'}</p></div>`);
    adv.push(`<div class="jp-adv jp-adv-tip"><div class="jp-adv-t">总结</div><p>命盘只是底色，真正决定人生的是你的选择与努力。${gradeWord(d).includes('开创') ? '你的格局需要主动开创，越努力越能翻转命运。' : '顺势而为、扬长避短，把先天优势用足，便能走出一条踏实而精彩的路。'}建议把这份解读当作认识自己的镜子，而非束缚自己的标签。</p></div>`);
    return adv.join('\n');
  }

  // ---------- 解盘同步：三态门禁 ----------
  function syncJiepan() {
    const pane = $('tab-jiepan');
    if (!pane) return;
    const hasChart = !!state.data;
    const score = state.dpScore;
    // 仅当用户真正处于解盘 tab 时才记录门禁事件（避免 init/重排盘时的后台同步误报）
    const viewing = pane.classList.contains('active');

    if (!hasChart) {
      pane.innerHTML = jiepanGate('paipan',
        '解盘前，请先完成排盘和定盘',
        '为保证解读的严谨，解盘必须建立在一张<b>已校验</b>的命盘之上。请先到「排盘」页填写出生信息生成命盘，再到「定盘」页完成时辰校验；只有定盘契合分达到 ' + JIEPAN_PASS + ' 分，才会开放解盘。',
        '前往排盘 →', 'paipan');
      if (viewing) trk('jiepan_gate_block', { reason: 'no_chart', score: null });
      bindGateBtn(pane);
      return;
    }
    if (!state.jiepan.unlocked) {
      const done = score !== null && score !== undefined;
      const passed = done && score >= JIEPAN_PASS;
      if (done && passed) {
        // 定盘达标但用户尚未点「触发解盘」：提供一键解盘
        pane.innerHTML = jiepanGate('jiepan',
          '时辰已校验通过，可以解盘了',
          `你的定盘契合分为 <b style="color:#1f9d55">${score}</b> 分，已达到 ${JIEPAN_PASS} 分的解盘门槛。点击下方按钮，即可基于本盘生成完整的命理详批。`,
          '生成解盘详批 →', 'dojiepan');
      } else if (done && !passed) {
        pane.innerHTML = jiepanGate('locked',
          '解盘尚未解锁',
          `解盘必须在「定盘」契合分达到 <b>${JIEPAN_PASS}</b> 分后才会开放。你当前的契合分为 <b style="color:#d2664f">${score}</b> 分，时辰可能存在偏差，直接解读容易失准。请回到「定盘」页核对，或调整出生时辰重新排盘。`,
          '回到定盘校验 →', 'dingpan');
        if (viewing) trk('jiepan_gate_block', { reason: 'low_score', score: score });
      } else {
        pane.innerHTML = jiepanGate('dingpan',
          '请先完成定盘校验',
          '命盘已生成，但还需要一步「定盘」——通过四个维度的问卷核对出生时辰是否准确。只有契合分达到 ' + JIEPAN_PASS + ' 分，才会解锁解盘，确保解读建立在正确的时辰之上。',
          '前往定盘 →', 'dingpan');
        if (viewing) trk('jiepan_gate_block', { reason: 'no_dingpan', score: null });
      }
      bindGateBtn(pane);
      return;
    }

    // 已解锁：渲染解盘内容
    if (!state.jiepan.html) state.jiepan.html = buildJiepan(state.data);
    pane.innerHTML = `<div class="jiepan-wrap">${state.jiepan.html}</div>`;
    bindTocSpy(pane);
  }

  // 目录滚动高亮 + 平滑跳转
  function bindTocSpy(pane) {
    const toc = pane.querySelector('.jp-toc');
    if (!toc) return;
    const links = Array.from(toc.querySelectorAll('a'));
    const secs = links.map((a) => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
    // 埋点：目录锚点点击（看哪些板块最受关注）
    links.forEach((a) => {
      a.addEventListener('click', () => trk('jiepan_toc_click', { section: (a.textContent || '').trim() }));
    });
    const onScroll = () => {
      const line = 200; // 吸顶栏下方判定线
      let cur = secs[0];
      for (const s of secs) {
        if (s.getBoundingClientRect().top - line <= 0) cur = s; else break;
      }
      links.forEach((a) => a.classList.toggle('active', cur && a.getAttribute('href') === '#' + cur.id));
    };
    window.removeEventListener('scroll', state._tocSpy || (() => {}));
    state._tocSpy = onScroll;
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function jiepanGate(icon, title, desc, btnText, nav) {
    const icons = {
      paipan: '🧭', dingpan: '🎯', locked: '🔒', jiepan: '✨',
    };
    return `<div class="jp-gate">
      <div class="jp-gate-ico">${icons[icon] || '🧭'}</div>
      <h2>${title}</h2>
      <p>${desc}</p>
      <div class="jp-gate-steps">
        <span class="step ${state.data ? 'done' : 'on'}">1 排盘</span>
        <span class="step-arr">→</span>
        <span class="step ${state.jiepan.unlocked ? 'done' : (state.data ? (nav === 'dingpan' || nav === 'paipan' ? 'on' : 'done') : '')}">2 定盘</span>
        <span class="step-arr">→</span>
        <span class="step ${state.jiepan.unlocked ? 'done' : ''}">3 解盘</span>
      </div>
      <button class="btn-primary jp-gate-btn" data-gnav="${nav}">${btnText}</button>
    </div>`;
  }

  function bindGateBtn(pane) {
    const btn = pane.querySelector('[data-gnav]');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const nav = btn.dataset.gnav;
      if (nav === 'paipan') {
        trk('nav_repaipan', { from: 'jiepan_gate' });
        switchTab('paipan');
        $('formPanel').style.display = 'block';
        $('formPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (nav === 'dingpan') {
        switchTab('dingpan');
        requestAnimationFrame(function () { scrollToContentTop(true); });
      } else if (nav === 'dojiepan') {
        trk('jiepan_unlock', { score: state.dpScore, from: 'jiepan_gate' });
        trk('jiepan_generate', { score: state.dpScore });
        state.jiepan.unlocked = true;
        state.jiepan.html = buildJiepan(state.data);
        syncJiepan();
        requestAnimationFrame(function () { scrollToContentTop(true); });
      }
    });
  }

  // ---------- 导出图片 ----------
  function exportImage() {
    const target = $('boardWrap');
    const btn = $('exportBtn');
    const old = btn.textContent;
    btn.textContent = '生成中...';
    btn.disabled = true;
    trk('paipan_export_img', {});
    html2canvas(target, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false })
      .then((canvas) => {
        const link = document.createElement('a');
        const nm = (state.data && state.data.name) ? state.data.name : '命盘';
        link.download = `紫微斗数命盘_${nm}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        btn.textContent = old;
        btn.disabled = false;
        $('status').className = 'status-msg';
        $('status').textContent = '图片已导出 ✓';
      })
      .catch((e) => {
        console.error(e);
        btn.textContent = old;
        btn.disabled = false;
        showErr('导出失败：' + (e && e.message ? e.message : ''));
      });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
