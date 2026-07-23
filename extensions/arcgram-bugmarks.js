/* Arcgram BugMarks -- bug / logic-hole overlay for an Arcgram flow
   Arcgram extension -- (c) 2026 Rae Sun -- Apache-2.0 -- https://arcgram.io
   Standalone overlay: load as a <script> AFTER the Arcgram engine. No deps, no CDN.
   Usage + API: see extensions/README.md. "Made with Arcgram" attribution ON by default. */

(function(){
  'use strict';
  if (window.ArcgramBugs) return;

  var LEVELS = {
    high:   { color:'#FB0000', label:'HIGH', rank:3 },
    medium: { color:'#FF9F1C', label:'MED',  rank:2 },
    low:    { color:'#7FB2FF', label:'LOW',  rank:1 }
  };
  var VB = 89, ICON_WORLD = 28.8, P_BODY=null, P_HEAD=null, P_OUTLINE=null;
  if (window.Path2D){
    P_BODY = new Path2D('M67.2758 12.4598C69.1559 12.4598 70.68 13.9774 70.68 15.8496V30.0545C70.68 34.6902 66.906 38.4483 62.2505 38.4483H59.8433L63.1348 44.5015H79.5958C81.4759 44.5015 83 46.0192 83 47.8913C83 49.7634 81.4759 51.2811 79.5958 51.2811H66.6046C67.2337 53.4254 67.0071 55.7819 65.9243 57.7732L64.3197 60.7241H68.7347C73.3902 60.7241 77.1642 64.4822 77.1642 69.1179V79.6102C77.1642 81.4823 75.6401 83 73.76 83C71.8799 83 70.3558 81.4823 70.3558 79.6102V69.1179C70.3558 68.2264 69.63 67.5037 68.7347 67.5037H60.6333L58.3703 71.6653C57.0006 74.1843 54.4693 75.7361 51.7298 75.7361H49.1574C48.2473 75.7361 47.5159 74.9902 47.5306 74.0841C47.6315 67.887 47.4989 61.6738 47.4989 55.478C47.4989 53.6059 45.9748 52.0882 44.0947 52.0882C42.2147 52.0882 40.6905 53.6059 40.6905 55.478C40.6905 61.6738 40.5578 67.8871 40.6587 74.0841C40.6735 74.9902 39.9422 75.7361 39.0321 75.7361H36.6219C33.8825 75.7361 31.351 74.1843 29.9813 71.6653L27.7185 67.5037H18.32C17.4247 67.5037 16.6989 68.2264 16.6989 69.1179V79.6102C16.6989 81.4823 15.1748 83 13.2947 83C11.4146 83 9.89053 81.4823 9.89053 79.6102V69.1179C9.89053 64.4822 13.6645 60.7241 18.32 60.7241H24.032L22.4274 57.7732C21.3446 55.7819 21.1181 53.4254 21.7472 51.2811H9.40421C7.52412 51.2811 6 49.7634 6 47.8913C6 46.0192 7.52412 44.5015 9.40421 44.5015H25.2169L28.5084 38.4483H26.1011C21.4456 38.4483 17.6716 34.6902 17.6716 30.0545V15.8496C17.6716 13.9774 19.1957 12.4598 21.0758 12.4598C22.9559 12.4598 24.48 13.9774 24.48 15.8496V30.0545C24.48 30.946 25.2058 31.6687 26.1011 31.6687H62.2505C63.1458 31.6687 63.8716 30.946 63.8716 30.0545V15.8496C63.8716 13.9774 65.3957 12.4598 67.2758 12.4598Z');
    P_HEAD = new Path2D('M41.5333 7.49123C42.7291 5.50293 45.6225 5.50292 46.8182 7.49123L55.0715 21.2149C56.3009 23.2591 54.822 25.8576 52.4291 25.8576H35.9225C33.5296 25.8576 32.0507 23.2591 33.2801 21.2149L41.5333 7.49123Z');
    P_OUTLINE = new Path2D('M47.5049 57.8016C47.5289 63.2264 47.6189 68.6616 47.5306 74.0841C47.5168 74.9337 48.1589 75.6422 48.9893 75.7274L49.1574 75.7361H51.7298L51.9863 75.7313C54.6265 75.6377 57.0434 74.1055 58.3703 71.6653L60.6333 67.5037H68.7347C69.63 67.5037 70.3558 68.2264 70.3558 69.1179V79.6102C70.3558 81.4823 71.8799 83 73.76 83C75.5815 83 77.0692 81.5753 77.1602 79.784L77.1642 79.6102V69.1179C77.1642 64.4822 73.3902 60.7241 68.7347 60.7241H64.3197L65.9243 57.7732C67.0071 55.7819 67.2337 53.4254 66.6046 51.2811H79.5958L79.7705 51.2762C81.5115 51.1885 82.907 49.7988 82.9951 48.0653L83 47.8913C83 46.0775 81.5694 44.5962 79.7705 44.5057L79.5958 44.5015L79.5957 38.5018C84.7655 38.5018 89 42.6816 89 47.8914C88.9998 53.1011 84.7654 57.2811 79.5957 57.2811H76.9443C80.6979 59.8754 83.1641 64.2011 83.1641 69.118V79.6102C83.164 84.8199 78.9295 88.9998 73.7598 88.9998C68.5901 88.9997 64.3556 84.8198 64.3555 79.6102V73.5037H64.2002L63.6416 74.5311C61.2827 78.8693 56.7922 81.7361 51.7295 81.7362H49.1572C47.211 81.7361 45.4402 81.0062 44.0947 79.8104C42.8416 80.9242 41.2194 81.6336 39.4297 81.7254L39.0322 81.7362H36.6221C31.5594 81.7362 27.069 78.8694 24.71 74.5311L24.1514 73.5037H22.6992V79.6102C22.6991 84.8198 18.4646 88.9997 13.2949 88.9998C8.12518 88.9998 3.89071 84.8199 3.89062 79.6102V69.118C3.89062 64.2011 6.35683 59.8754 10.1104 57.2811H9.4043C4.39618 57.2811 0.266141 53.3583 0.0126953 48.3768L0 47.8914L0.0126953 47.4061C0.265835 42.4243 4.39599 38.5018 9.4043 38.5018L9.40421 44.5015L9.22949 44.5057C7.43059 44.5962 6 46.0775 6 47.8913C6.00016 49.7049 7.4307 51.1856 9.22949 51.2762L9.40421 51.2811H21.7472C21.1181 53.4254 21.3446 55.7819 22.4274 57.7732L24.032 60.7241H18.32C13.6645 60.7241 9.89053 64.4822 9.89053 69.1179V79.6102C9.89061 81.4236 11.3207 82.9039 13.1191 82.9949L13.2947 83C15.1161 82.9999 16.6034 81.5752 16.6943 79.784L16.6989 79.6102V69.1179C16.6989 68.2821 17.3368 67.5942 18.1543 67.5115L18.32 67.5037H27.7185L29.9813 71.6653L30.1133 71.8983C31.4645 74.2025 33.8102 75.6407 36.3652 75.7313L36.6219 75.7361H39.0321L39.2002 75.7274C39.9752 75.6479 40.5866 75.0252 40.6533 74.2518L40.6587 74.0841C40.5578 67.8871 40.6905 61.6738 40.6905 55.478C40.6905 53.6059 42.2147 52.0882 44.0947 52.0882C45.9748 52.0882 47.4989 53.6059 47.4989 55.478L47.5049 57.8016ZM70.68 30.0545V15.8496C70.68 13.9774 69.1559 12.4598 67.2758 12.4598C65.3957 12.4598 63.8716 13.9774 63.8716 15.8496V30.0545L63.8633 30.2195C63.7802 31.0333 63.0896 31.6684 62.2505 31.6687H26.1011L25.9355 31.66C25.1726 31.5829 24.5659 30.9792 24.4883 30.2195L24.48 30.0545V15.8496C24.48 13.9774 22.9559 12.4598 21.0758 12.4598C19.1957 12.4598 17.6716 13.9774 17.6716 15.8496V30.0545L17.6826 30.4862C17.9083 34.9211 21.5913 38.448 26.1011 38.4483H28.5084L25.2169 44.5015H9.40421L9.4043 38.5018H14.417C12.6916 36.1322 11.6719 33.2157 11.6719 30.0545V15.8494C11.6719 10.6396 15.9064 6.45978 21.0762 6.45978L21.5576 6.4715C26.0262 6.69735 29.6996 10.047 30.3701 14.411L36.3916 4.39924L36.5605 4.12775C40.1839 -1.46515 48.4877 -1.37429 51.96 4.39924L57.9805 14.411C58.6749 9.89118 62.5914 6.45998 67.2754 6.45978L67.7578 6.4715C72.7062 6.7217 76.6797 10.8025 76.6797 15.8494V30.0545C76.6796 33.2157 75.66 36.1322 73.9346 38.5018H79.5957L79.5958 44.5015H63.1348L59.8433 38.4483H62.2505C66.7603 38.448 70.4432 34.9211 70.6689 30.4862L70.68 30.0545ZM46.8182 7.49123C45.6225 5.50292 42.7291 5.50293 41.5333 7.49123L33.2801 21.2149C32.0507 23.2591 33.5296 25.8576 35.9225 25.8576H52.4291C54.822 25.8576 56.3009 23.2591 55.0715 21.2149L46.8182 7.49123Z');
  }

  var BUG_SVG = "<svg viewBox=\"0 0 89 89\" width=\"15\" height=\"15\" style=\"flex-shrink:0\"><path fill=\"#FB0000\" d=\"M67.2758 12.4598C69.1559 12.4598 70.68 13.9774 70.68 15.8496V30.0545C70.68 34.6902 66.906 38.4483 62.2505 38.4483H59.8433L63.1348 44.5015H79.5958C81.4759 44.5015 83 46.0192 83 47.8913C83 49.7634 81.4759 51.2811 79.5958 51.2811H66.6046C67.2337 53.4254 67.0071 55.7819 65.9243 57.7732L64.3197 60.7241H68.7347C73.3902 60.7241 77.1642 64.4822 77.1642 69.1179V79.6102C77.1642 81.4823 75.6401 83 73.76 83C71.8799 83 70.3558 81.4823 70.3558 79.6102V69.1179C70.3558 68.2264 69.63 67.5037 68.7347 67.5037H60.6333L58.3703 71.6653C57.0006 74.1843 54.4693 75.7361 51.7298 75.7361H49.1574C48.2473 75.7361 47.5159 74.9902 47.5306 74.0841C47.6315 67.887 47.4989 61.6738 47.4989 55.478C47.4989 53.6059 45.9748 52.0882 44.0947 52.0882C42.2147 52.0882 40.6905 53.6059 40.6905 55.478C40.6905 61.6738 40.5578 67.8871 40.6587 74.0841C40.6735 74.9902 39.9422 75.7361 39.0321 75.7361H36.6219C33.8825 75.7361 31.351 74.1843 29.9813 71.6653L27.7185 67.5037H18.32C17.4247 67.5037 16.6989 68.2264 16.6989 69.1179V79.6102C16.6989 81.4823 15.1748 83 13.2947 83C11.4146 83 9.89053 81.4823 9.89053 79.6102V69.1179C9.89053 64.4822 13.6645 60.7241 18.32 60.7241H24.032L22.4274 57.7732C21.3446 55.7819 21.1181 53.4254 21.7472 51.2811H9.40421C7.52412 51.2811 6 49.7634 6 47.8913C6 46.0192 7.52412 44.5015 9.40421 44.5015H25.2169L28.5084 38.4483H26.1011C21.4456 38.4483 17.6716 34.6902 17.6716 30.0545V15.8496C17.6716 13.9774 19.1957 12.4598 21.0758 12.4598C22.9559 12.4598 24.48 13.9774 24.48 15.8496V30.0545C24.48 30.946 25.2058 31.6687 26.1011 31.6687H62.2505C63.1458 31.6687 63.8716 30.946 63.8716 30.0545V15.8496C63.8716 13.9774 65.3957 12.4598 67.2758 12.4598Z\"/><path fill=\"#FB0000\" d=\"M41.5333 7.49123C42.7291 5.50293 45.6225 5.50292 46.8182 7.49123L55.0715 21.2149C56.3009 23.2591 54.822 25.8576 52.4291 25.8576H35.9225C33.5296 25.8576 32.0507 23.2591 33.2801 21.2149L41.5333 7.49123Z\"/><path fill=\"#000\" d=\"M47.5049 57.8016C47.5289 63.2264 47.6189 68.6616 47.5306 74.0841C47.5168 74.9337 48.1589 75.6422 48.9893 75.7274L49.1574 75.7361H51.7298L51.9863 75.7313C54.6265 75.6377 57.0434 74.1055 58.3703 71.6653L60.6333 67.5037H68.7347C69.63 67.5037 70.3558 68.2264 70.3558 69.1179V79.6102C70.3558 81.4823 71.8799 83 73.76 83C75.5815 83 77.0692 81.5753 77.1602 79.784L77.1642 79.6102V69.1179C77.1642 64.4822 73.3902 60.7241 68.7347 60.7241H64.3197L65.9243 57.7732C67.0071 55.7819 67.2337 53.4254 66.6046 51.2811H79.5958L79.7705 51.2762C81.5115 51.1885 82.907 49.7988 82.9951 48.0653L83 47.8913C83 46.0775 81.5694 44.5962 79.7705 44.5057L79.5958 44.5015L79.5957 38.5018C84.7655 38.5018 89 42.6816 89 47.8914C88.9998 53.1011 84.7654 57.2811 79.5957 57.2811H76.9443C80.6979 59.8754 83.1641 64.2011 83.1641 69.118V79.6102C83.164 84.8199 78.9295 88.9998 73.7598 88.9998C68.5901 88.9997 64.3556 84.8198 64.3555 79.6102V73.5037H64.2002L63.6416 74.5311C61.2827 78.8693 56.7922 81.7361 51.7295 81.7362H49.1572C47.211 81.7361 45.4402 81.0062 44.0947 79.8104C42.8416 80.9242 41.2194 81.6336 39.4297 81.7254L39.0322 81.7362H36.6221C31.5594 81.7362 27.069 78.8694 24.71 74.5311L24.1514 73.5037H22.6992V79.6102C22.6991 84.8198 18.4646 88.9997 13.2949 88.9998C8.12518 88.9998 3.89071 84.8199 3.89062 79.6102V69.118C3.89062 64.2011 6.35683 59.8754 10.1104 57.2811H9.4043C4.39618 57.2811 0.266141 53.3583 0.0126953 48.3768L0 47.8914L0.0126953 47.4061C0.265835 42.4243 4.39599 38.5018 9.4043 38.5018L9.40421 44.5015L9.22949 44.5057C7.43059 44.5962 6 46.0775 6 47.8913C6.00016 49.7049 7.4307 51.1856 9.22949 51.2762L9.40421 51.2811H21.7472C21.1181 53.4254 21.3446 55.7819 22.4274 57.7732L24.032 60.7241H18.32C13.6645 60.7241 9.89053 64.4822 9.89053 69.1179V79.6102C9.89061 81.4236 11.3207 82.9039 13.1191 82.9949L13.2947 83C15.1161 82.9999 16.6034 81.5752 16.6943 79.784L16.6989 79.6102V69.1179C16.6989 68.2821 17.3368 67.5942 18.1543 67.5115L18.32 67.5037H27.7185L29.9813 71.6653L30.1133 71.8983C31.4645 74.2025 33.8102 75.6407 36.3652 75.7313L36.6219 75.7361H39.0321L39.2002 75.7274C39.9752 75.6479 40.5866 75.0252 40.6533 74.2518L40.6587 74.0841C40.5578 67.8871 40.6905 61.6738 40.6905 55.478C40.6905 53.6059 42.2147 52.0882 44.0947 52.0882C45.9748 52.0882 47.4989 53.6059 47.4989 55.478L47.5049 57.8016ZM70.68 30.0545V15.8496C70.68 13.9774 69.1559 12.4598 67.2758 12.4598C65.3957 12.4598 63.8716 13.9774 63.8716 15.8496V30.0545L63.8633 30.2195C63.7802 31.0333 63.0896 31.6684 62.2505 31.6687H26.1011L25.9355 31.66C25.1726 31.5829 24.5659 30.9792 24.4883 30.2195L24.48 30.0545V15.8496C24.48 13.9774 22.9559 12.4598 21.0758 12.4598C19.1957 12.4598 17.6716 13.9774 17.6716 15.8496V30.0545L17.6826 30.4862C17.9083 34.9211 21.5913 38.448 26.1011 38.4483H28.5084L25.2169 44.5015H9.40421L9.4043 38.5018H14.417C12.6916 36.1322 11.6719 33.2157 11.6719 30.0545V15.8494C11.6719 10.6396 15.9064 6.45978 21.0762 6.45978L21.5576 6.4715C26.0262 6.69735 29.6996 10.047 30.3701 14.411L36.3916 4.39924L36.5605 4.12775C40.1839 -1.46515 48.4877 -1.37429 51.96 4.39924L57.9805 14.411C58.6749 9.89118 62.5914 6.45998 67.2754 6.45978L67.7578 6.4715C72.7062 6.7217 76.6797 10.8025 76.6797 15.8494V30.0545C76.6796 33.2157 75.66 36.1322 73.9346 38.5018H79.5957L79.5958 44.5015H63.1348L59.8433 38.4483H62.2505C66.7603 38.448 70.4432 34.9211 70.6689 30.4862L70.68 30.0545ZM46.8182 7.49123C45.6225 5.50292 42.7291 5.50293 41.5333 7.49123L33.2801 21.2149C32.0507 23.2591 33.5296 25.8576 35.9225 25.8576H52.4291C54.822 25.8576 56.3009 23.2591 55.0715 21.2149L46.8182 7.49123Z\"/></svg>";
  var C0 = document.getElementById('c');
  var bugs = [], visible = true, expanded = false, showCompleted = false;
  var DONE_COL = '#2f9e5e';

  var SUPER_COL = '#ffb454';
  function closedCol(b){ return b.disposition === 'SUPERSEDED' ? SUPER_COL : DONE_COL; }
  function closedGlyph(b){ return b.disposition === 'SUPERSEDED' ? '&#9888;' : '&#10003;'; }

  function css(id, txt){ var s=document.createElement('style'); s.id=id; s.textContent=txt; document.head.appendChild(s); }
  css('abm-css',
    '#abm-ov{position:fixed;pointer-events:none;z-index:60}'+
    '#abm-tags{position:fixed;inset:0;pointer-events:none;z-index:61}'+
    '.abm-tag{position:absolute;pointer-events:auto;cursor:pointer;font:600 11px system-ui,sans-serif;background:rgba(11,13,24,.94);color:#cdd2ee;border:1px solid #3a3f5e;border-radius:5px;padding:3px 9px;white-space:nowrap;display:flex;align-items:center;gap:6px}'+
    '.abm-tag:hover{border-color:#5a6088;background:rgba(20,23,40,.97)}'+
    '#abm-list{position:fixed;left:16px;bottom:16px;z-index:62;font:600 12px system-ui,sans-serif}'+
    '.abm-lh{display:flex;align-items:center;gap:10px;background:rgba(11,13,24,.94);color:#cdd2ee;border:1px solid #2a2f4e;border-radius:8px;padding:8px 12px}'+
    '.abm-head{display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;background:none;border:none;color:inherit;font:inherit}'+
    '.abm-cnt{background:#FB0000;color:#fff;border-radius:10px;padding:1px 8px;font-size:11px}'+
    '.abm-fold{color:#8a93b2;transition:transform .15s}.abm-fold.up{transform:rotate(180deg)}'+
    '.abm-sws{display:flex;align-items:center;gap:14px;margin-left:auto}'+
    '.abm-swwrap{display:flex;align-items:center;gap:6px;color:#8a93b2;font-size:11px}'+
    '.abm-sw{width:38px;height:20px;border-radius:11px;background:#2a2f4e;position:relative;cursor:pointer;border:none;padding:0;flex-shrink:0;transition:background .15s}'+
    '.abm-sw.on{background:#2f9e5e}.abm-sw .kn{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s}.abm-sw.on .kn{left:20px}'+
    '.abm-body{margin-top:6px;background:rgba(11,13,24,.94);border:1px solid #2a2f4e;border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:2px;max-width:380px}'+
    '.abm-row{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:5px;color:#cdd2ee;cursor:pointer;line-height:1.4;font-weight:400}'+
    '.abm-row:hover{background:rgba(255,255,255,.06)}'+
    '.abm-row .lv{font-size:9px;font-weight:700;letter-spacing:.4px;border-radius:3px;padding:1px 5px;color:#0b0d18;flex-shrink:0}'+
    '.abm-row .ty{font-size:9px;color:#8a93b2;text-transform:uppercase;letter-spacing:.3px}'+
    '.abm-row.abm-done{color:#6a7092}.abm-row.abm-done b{color:#6a7092!important;font-weight:400}.abm-row.abm-done .lv{opacity:.5}'+
    '.abm-ck{color:#2f9e5e;font-weight:700;flex-shrink:0}'+
    '#abm-detail{position:fixed;display:none;z-index:63;width:346px;background:rgba(11,13,24,.97);border:1px solid #2a2f4e;border-radius:10px;padding:14px 16px 16px;color:#cdd2ee;font:400 13px/1.55 system-ui,sans-serif;box-shadow:0 10px 34px rgba(0,0,0,.55)}'+
    '#abm-detail .bx{position:absolute;right:8px;top:5px;background:none;border:none;color:#8a93b2;font-size:19px;line-height:1;cursor:pointer}'+
    '#abm-detail .dt{font:600 14px system-ui,sans-serif;margin-bottom:4px;padding-right:18px;display:flex;align-items:center;gap:8px}'+
    '#abm-detail .dt .lv{font-size:10px;font-weight:700;border-radius:3px;padding:1px 6px;color:#0b0d18}'+
    '#abm-detail .dm{font:600 11px system-ui,sans-serif;letter-spacing:.4px;color:#8a93b2;margin-bottom:9px;text-transform:uppercase}'+
    '#abm-detail .ev{margin-top:10px;padding:6px 9px;border-left:2px solid #3a3f5e;background:rgba(255,255,255,.03);border-radius:0 5px 5px 0;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#9aa0bf;white-space:pre-wrap}'+

    '#abm-detail .abm-rev{border-left-color:#ffb454;background:rgba(255,180,84,.07);color:#e7c48d}'+
    '#abm-detail .abm-rev b{color:#ffb454}'+
    '#abm-detail .ev b{color:#8a93b2;font-weight:600;text-transform:uppercase;font-family:system-ui,sans-serif;font-size:9px;letter-spacing:.4px;display:block;margin-bottom:2px}');

  var ov=document.createElement('canvas'); ov.id='abm-ov'; document.body.appendChild(ov);
  var octx=ov.getContext('2d');
  var tagsWrap=document.createElement('div'); tagsWrap.id='abm-tags'; document.body.appendChild(tagsWrap);
  var listEl=document.createElement('div'); listEl.id='abm-list'; document.body.appendChild(listEl);
  var detailEl=document.createElement('div'); detailEl.id='abm-detail'; document.body.appendChild(detailEl);

  function lv(b){ return LEVELS[b.level] || LEVELS.medium; }
  function floorCheck(b){
    var wn=[];
    if(!b.anchor || (!b.anchor.node && !b.anchor.edge && !b.anchor.world)) wn.push('no anchor (node/edge/world)');
    else if(b.anchor.node && typeof nodeById!=='undefined' && nodeById && Object.keys(nodeById).length && !nodeById[b.anchor.node]) wn.push('anchor.node "'+b.anchor.node+'" not in nodeById');
    if(!b.evidence) wn.push('empty evidence — ground the cause in scanner/runtime output (see README)');
    if(!b.reason) wn.push('no reason');
    if(wn.length && typeof console!=='undefined' && console.warn) console.warn('ArcgramBugs: mark '+(b.id||'?')+' — '+wn.join('; '));
  }
  function normalize(b){
    floorCheck(b);
    return { id:b.id||('bug'+String(Math.floor(Math.random()*10000)).padStart(4,'0')), level:(LEVELS[b.level]?b.level:'medium'),
             type:b.type||'logic', anchor:b.anchor||{world:{x:0,y:0}}, reason:b.reason||'(unlabeled)', desc:b.desc||'',
             evidence:b.evidence||'',
             resolved:!!b.resolved,

             disposition:(b.disposition||(b.resolved?'FIXED':'')),
             resolution:b.resolution||'',
             revivesIf:b.revivesIf||'',
             _ph:Math.random()*6.28 };
  }

  function markPoint(a){
    if(!a) return {x:0,y:0};
    if(a.node && typeof nodeById!=='undefined' && nodeById[a.node]){ var n=nodeById[a.node]; return {x:n.x+n.w, y:n.y}; }
    if(a.edge && typeof edges!=='undefined'){ var e=edges.find(function(e){return e.f===a.edge.f&&e.t===a.edge.t&&(!a.edge.lbl||e.lbl===a.edge.lbl);});
      if(e){ if(e._pillBox) return {x:e._pillBox.x+e._pillBox.w, y:e._pillBox.y}; if(e._path&&e._path.length){var p=e._path[Math.floor(e._path.length/2)]; return {x:p.x,y:p.y};} } }
    if(a.world) return a.world;
    return {x:0,y:0};
  }
  function w2s(w){ if(typeof view==='undefined') return {x:0,y:0}; return {x:w.x*view.scale+view.tx, y:w.y*view.scale+view.ty}; }

  function drawIcon(cx,cy,sz,glow){
    if(!P_BODY){ octx.beginPath(); octx.arc(cx,cy,sz*0.32,0,7); octx.fillStyle='#FB0000'; octx.fill(); return; }
    var sc=sz/VB; octx.save(); octx.translate(cx-sz/2, cy-sz/2); octx.scale(sc,sc);
    if(glow){ octx.shadowColor='rgba(251,0,0,0.85)'; octx.shadowBlur=glow/sc; }
    octx.fillStyle='#FB0000'; octx.fill(P_BODY); octx.fill(P_HEAD);
    octx.shadowBlur=0; octx.fillStyle='#000000'; octx.fill(P_OUTLINE); octx.restore();
  }

  function openDetail(b){
    var s=w2s(markPoint(b.anchor)), col=lv(b).color;
    detailEl.style.borderColor=b.resolved?closedCol(b):col;
    detailEl.innerHTML='<button class="bx">&times;</button>'
      +'<div class="dt">'+(b.resolved?'<span class="abm-ck" style="color:'+closedCol(b)+'">'+closedGlyph(b)+'</span> ':'')+'<span class="lv" style="background:'+col+'">'+lv(b).label+'</span>'+b.reason+'</div>'
      +'<div class="dm">'+b.type+' &middot; '+b.id+(b.resolved?' &middot; '+b.disposition:'')+'</div>'
      +'<div class="dd">'+b.desc+'</div>'
      +(b.resolution?'<div class="ev"><b>'+(b.disposition==='SUPERSEDED'?'superseded — NOT fixed':'resolved')+'</b>'+b.resolution+'</div>':'')

      +(b.revivesIf?'<div class="ev abm-rev"><b>&#9888; still open — revives if</b>'+b.revivesIf+'</div>':'')
      +(b.evidence?'<div class="ev"><b>grounded in</b>'+b.evidence+'</div>':'');
    detailEl.querySelector('.bx').addEventListener('click',function(ev){ ev.stopPropagation(); detailEl.style.display='none'; });
    detailEl.style.display='block';
    var dx=Math.min(Math.max(12,s.x+40), window.innerWidth-358), dy=Math.min(Math.max(12,s.y+20), window.innerHeight-200);
    detailEl.style.left=dx+'px'; detailEl.style.top=dy+'px';
  }
  document.addEventListener('click',function(e){
    if(detailEl.style.display==='block' && !detailEl.contains(e.target) && !e.target.closest('.abm-tag') && !e.target.closest('.abm-row')) detailEl.style.display='none';
  });

  var tagEls={};
  function buildTags(){
    tagsWrap.innerHTML=''; tagEls={};
    bugs.forEach(function(b){
      var el=document.createElement('button'); el.className='abm-tag';
      el.textContent=b.reason;
      el.addEventListener('click',function(ev){ ev.stopPropagation(); openDetail(b); });
      tagsWrap.appendChild(el); tagEls[b.id]=el;
    });
  }

  function renderList(){

    if(!bugs.length){ listEl.innerHTML=''; return; }
    var openCount=bugs.filter(function(b){return !b.resolved;}).length;
    var head='<div class="abm-lh">'
      +'<button class="abm-head">'+BUG_SVG+' Audit <span class="abm-cnt">'+openCount+'</span> <span class="abm-fold'+(expanded?' up':'')+'">&#9662;</span></button>'
      +'<span class="abm-sws">'
      +'<span class="abm-swwrap">Show on flow <button class="abm-sw abm-sw-flow'+(visible?' on':'')+'" title="toggle badges on the flow"><span class="kn"></span></button></span>'
      +'<span class="abm-swwrap">Show completed <button class="abm-sw abm-sw-done'+(showCompleted?' on':'')+'" title="show fixed items on the flow"><span class="kn"></span></button></span>'
      +'</span>'
      +'</div>';
    var body='';
    if(expanded){
      body=bugs.length? '<div class="abm-body">'+bugs.slice().sort(function(a,b){ if(!!a.resolved!==!!b.resolved) return a.resolved?1:-1; return lv(b).rank-lv(a).rank; }).map(function(b){ var col=lv(b).color;

        if(b.resolved) return '<div class="abm-row abm-done" data-id="'+b.id+'"><span class="abm-ck" style="color:'+closedCol(b)+'">'+closedGlyph(b)+'</span><span class="lv" style="background:'+col+'">'+lv(b).label+'</span><b>'+b.reason+'</b> <span class="ty">'+(b.disposition==='SUPERSEDED'?'<span style="color:#ffb454">SUPERSEDED</span>':b.type)+'</span></div>';
        return '<div class="abm-row" data-id="'+b.id+'"><span class="lv" style="background:'+col+'">'+lv(b).label+'</span><b style="color:'+col+'">'+b.reason+'</b> <span class="ty">'+b.type+'</span></div>';
      }).join('')+'</div>' : '<div class="abm-body" style="color:#8a93b2;font-weight:400">No issues found.</div>';
    }
    listEl.innerHTML=head+body;
    listEl.querySelector('.abm-head').addEventListener('click',function(ev){ ev.stopPropagation(); expanded=!expanded; renderList(); });
    listEl.querySelector('.abm-sw-flow').addEventListener('click',function(ev){ ev.stopPropagation(); visible=!visible; syncVis(); renderList(); });
    listEl.querySelector('.abm-sw-done').addEventListener('click',function(ev){ ev.stopPropagation(); showCompleted=!showCompleted; renderList(); });
    if(expanded) listEl.querySelectorAll('.abm-row').forEach(function(r){ r.addEventListener('click',function(ev){ ev.stopPropagation(); openDetail(bugs.find(function(x){return x.id===r.dataset.id;})); }); });
  }
  function syncVis(){ ov.style.display=visible?'block':'none'; tagsWrap.style.display=visible?'block':'none'; }
  function rebuild(){ buildTags(); renderList(); }

  function frame(t){
    if(!C0){ requestAnimationFrame(frame); return; }
    var D=Math.max(1,window.devicePixelRatio||1), r=C0.getBoundingClientRect();
    ov.style.left=r.left+'px'; ov.style.top=r.top+'px'; ov.style.width=r.width+'px'; ov.style.height=r.height+'px';
    var w=Math.floor(r.width*D), h=Math.floor(r.height*D); if(ov.width!==w)ov.width=w; if(ov.height!==h)ov.height=h;
    octx.setTransform(D,0,0,D,0,0); octx.clearRect(0,0,r.width,r.height);
    if(!visible){ requestAnimationFrame(frame); return; }
    var sc=(typeof view!=='undefined')?view.scale:1;
    bugs.forEach(function(b){
      if(b.resolved && !showCompleted){ var el0=tagEls[b.id]; if(el0) el0.style.display='none'; return; }
      var s=w2s(markPoint(b.anchor)), el=tagEls[b.id];
      if(s.x<-80||s.y<-80||s.x>r.width+80||s.y>r.height+80){ if(el) el.style.display='none'; return; }
      var col=b.resolved?closedCol(b):lv(b).color;
      var R0=13;
      if(!b.resolved){ for(var k=0;k<2;k++){ var ph=(((t/1400)+k*0.5)%1); octx.beginPath(); octx.arc(s.x,s.y, R0+ph*20, 0, 7); octx.strokeStyle=col; octx.globalAlpha=(1-ph)*0.5; octx.lineWidth=2.5; octx.stroke(); } }
      octx.globalAlpha=1;
      octx.beginPath(); octx.arc(s.x,s.y, R0, 0, 7); octx.strokeStyle=col; octx.lineWidth=2.5; octx.stroke();
      octx.beginPath(); octx.arc(s.x,s.y, 3.5, 0, 7); octx.fillStyle=col; octx.fill();
      var leadX=(s.x>r.width*0.6)?-40:40, ly=s.y+30, lx=s.x+leadX;
      octx.beginPath(); octx.moveTo(s.x+(leadX>0?R0:-R0), s.y); octx.lineTo(lx,ly);
      octx.strokeStyle=col; octx.globalAlpha=0.7; octx.lineWidth=1.25; octx.stroke(); octx.globalAlpha=1;
      if(el){ el.style.display='flex'; el.style.left=(r.left+lx)+'px'; el.style.top=(r.top+ly)+'px'; el.style.transform=(leadX<0?'translate(-100%,-50%)':'translate(0,-50%)'); }
    });
    requestAnimationFrame(frame);
  }

  window.ArcgramBugs = {
    add:function(b){ b=normalize(b); bugs.push(b); rebuild(); return b.id; },
    set:function(arr){ bugs=(arr||[]).map(normalize); rebuild(); },
    clear:function(){ bugs=[]; rebuild(); },
    resolve:function(id){ var b=bugs.find(function(x){return x.id===id;}); if(b){ b.resolved=true; rebuild(); } return !!b; },
    reopen:function(id){ var b=bugs.find(function(x){return x.id===id;}); if(b){ b.resolved=false; rebuild(); } return !!b; },
    show:function(){ visible=true; syncVis(); renderList(); },
    hide:function(){ visible=false; syncVis(); renderList(); },
    toggle:function(){ visible=!visible; syncVis(); renderList(); },
    list:function(){ return bugs.map(function(b){return Object.assign({},b);}); }
  };
  Object.defineProperty(window.ArcgramBugs,'visible',{ get:function(){return visible;} });

  rebuild(); requestAnimationFrame(frame);
})();
