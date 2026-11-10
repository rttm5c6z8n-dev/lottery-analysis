# V29 数据获取修复（2026-11-10）

## 原因核查

Safari的Load failed仅说明浏览器不能读取响应，单凭此错误无法判定是CORS还是网络。V29原实现直接fetch体彩webapi接口，credentials omit、15秒超时，无服务端路径。

本次带本站Origin从执行环境读取当前接口：HTTP567、7352字节HTML验证页面，无允许本站的Access-Control-Allow-Origin。lottery.gov.cn/kj/kjlb.html?dlt和sporttery.cn/digitallottery/index.html也返回567。因此不是单纯浏览器CORS；不为这些验证入口做代理，不绕过验证码/反爬。

## 实际发现

江苏体彩 https://api.js-lottery.com/wfzq/dlt/data 正常返回官方历史列表，其网页脚本公开使用 /Lottery/_ListData?itemType=lo&pageindex=N，每页10条。页面声明2942条；实测第1页26128—26119、第2页26118—26109、末页295为07006、07005，共读取并严格解析22条样本。声明总数不等于已获取或已核验全部2942条；不推定等同原2945期。

该源CORS只允许https://trusted-app.com，不包含本站。正常HTTPS GET服务端可读，不需要登录、验证或伪造浏览器身份。Pages Function只读取这个网页自身公开的查询路径，固定host/path和game/itemType，不代理原HTTP567接口。上游若转为验证或拒绝访问立即停止。

单期原文 https://api.js-lottery.com/cms/post-148210.html 本次仍200，可人工核实26127期。未发现可确认的官方全量CSV/JSON发布文件，不猜测下载路径、不把第三方JSON称为官方数据。

## 获取方案

functions/api/jiangsu-dlt.js：GET /api/jiangsu-dlt?page=1，页码1—500，只请求固定江苏URL；10秒超时、最大1MB、禁止跟随重定向，非200和结构不符返回502且无证据。有效响应通过Cloudflare caches.default缓存及Cache-Control缓存5分钟。lib/jiangsu.mjs验证页码、总数、表格日期、五位期号、七个号码范围和组内唯一性、公告链接。无值不补造。

V29可每次1—5页（最多约50条），串行请求间隔500ms，取消或任一页失败整批不加入。仅保存实际取得记录和服务器读取时间，原始列表URL及具体原公告链接分开保存。支持下载本批CSV/JSON，保留原获取时间、原URL、完整号码及日期含义。重新导入文件时这些原声明信息保留，但不信任文件自带的origin/review等级；真实文件读取时间另存。

特别注意：官方列表的日期列明确为“发布日期”，不是已自动核实的开奖日期。页面及逐期追溯、CSV/JSON保留此含义。B仅表示官方列表来源已取得、数值机器一致且待人工核实；不能作为原公告完整认证。A级依然要求用户打开逐期原公告、核对期号/实际开奖日期/七个号码并确认。休市、第三方不得自动升级。

## 现有数据保护

不改历史、V17或V28代码/数据库/旧键。

追加证据保留已有results和cursor，不自动提升旧等级。恢复时保留旧结果快照，不依据刚追加的列表自动重算。旧A级缺少保存的完整字段和人工证据时停止并保留数据库供检查，不篡改原值。

V29数据库版本1→2只新增archives仓库；既有仓库不删除。用户主动重核或改变确认状态之前，将所有即将变更/移出当前任务的旧结果写入archives，再与当前结果及游标同一事务提交。JSON备份包含归档。任何失败事务均不推进保存进度。证据按原数组保留并只追加去重；不自动删除证据。

## 测试及限制

- tests/v29-source.test.mjs：本次真实第1/2/295页HTML，22条解析，错页、HTML验证页拒绝。测试依赖/tmp本次只读样本，不作为发布数据。
- tests/v29-function.test.mjs：固定URL无SSRF、非法页码400、302/403/567和验证HTML返回502、正常页面只给实际10条。
- tests/v29-acquisition.browser.cjs：隔离浏览器模拟Function响应（使用真实公开页样本），追加10条、重复取得不增；2945旧结果及游标在导入/刷新后逐字不变，A级不增；CSV/JSON原始字段完整；主动确认变更前2945旧结果归档；旧localStorage不变；390px无整页溢出。
- tests/v29.browser.cjs：V29原全流程回归（2945期无证据C/A0、来源身份及完整确认、事务回滚、刷新续跑、CSV/JSON、V28数据库及旧缓存保护）。
- 单元测试及受保护文件逐字节核对。

无法访问用户iPhone旧数据，不声称已导入其设备或核验其记录。环境缺少WebKit/实体iPhone，不能声称Safari实测。原Safari错误将明确提示验证页和替代源，而不把所有Load failed都归因CORS。生产Pages Function的上游访问需上线后实际验证，执行环境成功不代表Cloudflare出口一定成功。任何生产失败都应如实显示，不能以测试样本代替真实数据。
