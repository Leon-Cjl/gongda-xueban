package cn.qlucampus.personal;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.FileInputStream;
import java.io.ByteArrayOutputStream;
import java.io.FileNotFoundException;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/** Ordered, durable state writes. Acknowledgement happens only after sync and rename. */
final class DurableStateStore {
 interface Callback { void complete(Exception error); }
 interface LoadCallback { void complete(byte[] bytes, Exception error); }
 interface Committer { void commit(File temporary, File target) throws Exception; }
 private final File directory;
 private final Committer committer;
 // Shared across Activity recreation; a new Activity must not race an old writer on state.json.tmp.
 // No resident thread: the sole worker expires after one idle second.
 private static final ExecutorService worker = new ThreadPoolExecutor(0, 1, 1, TimeUnit.SECONDS,
   new LinkedBlockingQueue<Runnable>(), task -> new Thread(task, "campus-state-io"));
 private boolean closed;
 DurableStateStore(File directory) { this(directory, (temporary, target) -> { if (!temporary.renameTo(target)) throw new IOException("无法保存本机数据"); }); }
 DurableStateStore(File directory, Committer committer) { this.directory = directory; this.committer = committer; }
 synchronized void load(LoadCallback callback) {
  if (closed) { callback.complete(null, new IOException("本机数据正在关闭")); return; }
  worker.execute(() -> {
   byte[] data = null; Exception error = null;
   try (FileInputStream stream = new FileInputStream(new File(directory,"state.json")); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
    byte[] chunk = new byte[8192]; int size;
    while ((size=stream.read(chunk))!=-1) out.write(chunk,0,size);
    data = out.toByteArray();
   } catch (FileNotFoundException missing) { data = new byte[0]; }
   catch (Exception failure) { error = failure; }
   callback.complete(data,error);
  });
 }
 synchronized void save(byte[] bytes, Callback callback) {
  if (closed) { callback.complete(new IOException("本机数据正在关闭，请稍后重试")); return; }
  final byte[] snapshot = Arrays.copyOf(bytes, bytes.length);
  worker.execute(() -> {
   Exception error = null;
   try {
    File temporary = new File(directory, "state.json.tmp"), target = new File(directory, "state.json");
    try (FileOutputStream stream = new FileOutputStream(temporary)) { stream.write(snapshot); stream.getFD().sync(); }
    committer.commit(temporary, target);
   } catch (Exception failure) { error = failure; }
   callback.complete(error);
  });
 }
 synchronized void closeAfter(Runnable drained) {
  if (closed) return;
  closed = true;
  worker.execute(drained);
 }
 synchronized void close() { closed = true; }
}
