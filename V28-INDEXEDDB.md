# V28 IndexedDB修复

定位：原v28.js save(next)每批调用localStorage.setItem(C.KEY, JSON.stringify(C.packState(next)))，整份证据、结果、历史快照及进度反复写入同一键。该setItem是QuotaExceededError的直接写入点。无法访问用户设备，不能判断其余站点缓存占用或声称已迁移设备数据。

新增v28-storage.js：数据库lottery_v28_verified_storage，meta/evidence/results/inspections分表。证据按原顺序逐条保留；结果按期号为主键，不重复累计。每批只写变化记录及元数据，同一readwrite事务提交后才更新内存状态、游标、最后保存时间。事务abort时停止运行，保留前一成功批次。标签间revision检查防止旧任务覆盖新提交。

v28.js：保存路径改为await IndexedDB事务；启动时优先恢复数据库。不存在完整迁移时读取原独立键，验证版本、队列、游标及字段，按实际保存证据重新比对；写入数据库后读回检查证据、结果和独立明细完全一致，再单独提交迁移完成标记。待验证标记在失败后不会被当作完成；失败保留原localStorage与数据库，不执行删除数据库或清除历史。源历史变化时旧结果不计当前覆盖率，原旧键仍保留。人工审核标准和字段比对核心不变。

v28.html：保持原手机深色操作界面，新增IndexedDB存储状态与重新诊断按钮，显示实际持久保存游标、存储类型、最后提交时间及失败原因。

测试：node tests/v28-idb.browser.cjs 在隔离Chromium中构造2460/2945结果、2949份证据（含4份新增公告线索），禁止全部localStorage写入并抛QuotaExceededError。验证迁移、旧键逐字不变、迁移失败事务回滚无完成标记、运行事务失败后仍2460条与原游标、刷新续跑到2945唯一期号、2949证据不变、A级0、CSV2949明细行、原2945期历史和V17哨兵不变、IndexedDB不可用时报错。核心与追溯性单元测试、V27核心测试通过。所有网络/审核夹具为隔离测试，不作为发布的官方证据。

Safari限制：实现采用标准IndexedDB事务API，事务内部不await；无IndexedDB或访问拒绝明确报错，不回退到满额localStorage。已验证390px移动布局的Chromium流程。环境缺少Playwright WebKit执行文件，不能完成WebKit测试，也无法访问实体iPhone，因此不能声称实际iPhone Safari验收通过。Safari私人浏览、存储被系统清理或用户清除网站数据可能导致不可用，页面会报告错误；没有代码自动清除任何原缓存。

手机验收：在原设备原Safari浏览器正常模式、原站域名打开/v28.html，先关闭其他V28标签。等待存储状态显示“IndexedDB”和“迁移完成（读回校验成功，旧键保留）”，确认实际已保存期数及2949证据。若迁移失败，停止操作并保留旧数据，不清除网站数据，不重新导入替换。成功后点开始/续跑，观察保存期数递增；停止后刷新，再确认从同一位置恢复。完成后2945唯一期号、4条新增证据仍在，来源待核不会变A；下载CSV备份。原localStorage键与V17均未删除。尚未访问用户设备，实际迁移必须由设备打开新版完成。
