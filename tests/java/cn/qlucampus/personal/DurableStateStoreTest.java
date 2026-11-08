package cn.qlucampus.personal;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;

public class DurableStateStoreTest {
 public static void main(String[] args) throws Exception {
  File dir = Files.createTempDirectory("gongda-store-").toFile();
  String mainThread = Thread.currentThread().getName();
  // Android's rename replaces an existing file atomically; Windows File.renameTo does not.
  DurableStateStore.Committer replace = (temporary,target) -> Files.move(temporary.toPath(),target.toPath(),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
  DurableStateStore first = new DurableStateStore(dir, replace);
  List<Integer> finished = Collections.synchronizedList(new ArrayList<Integer>());
  AtomicReference<Throwable> failure = new AtomicReference<>();
  CountDownLatch saved = new CountDownLatch(30);
  for (int i=0;i<30;i++) {
   final int value=i;
   first.save(Integer.toString(i).getBytes("UTF-8"), error -> {
    if (error != null) failure.set(error);
    if (Thread.currentThread().getName().equals(mainThread)) failure.set(new AssertionError("disk write ran on caller thread"));
    finished.add(value); saved.countDown();
   });
  }
  first.close();
  // A recreated Activity shares the same ordered writer, so its save must win.
  DurableStateStore second = new DurableStateStore(dir, replace);
  CountDownLatch loaded = new CountDownLatch(1);
  second.load((bytes,error)->{if(error!=null||!new String(bytes,java.nio.charset.StandardCharsets.UTF_8).equals("29"))failure.set(new AssertionError("new Activity read before pending writes drained"));loaded.countDown();});
  second.save("new-activity".getBytes("UTF-8"), error -> { if (error != null) failure.set(error); });
  CountDownLatch drained = new CountDownLatch(1);
  second.closeAfter(() -> {
   try {
    if (!new String(Files.readAllBytes(new File(dir,"state.json").toPath()),"UTF-8").equals("new-activity")) throw new AssertionError("stale Activity overwrote new state");
    Files.delete(new File(dir,"state.json").toPath());
   } catch (Throwable e) { failure.set(e); }
   drained.countDown();
  });
  if (!saved.await(10,TimeUnit.SECONDS)||!loaded.await(10,TimeUnit.SECONDS)||!drained.await(10,TimeUnit.SECONDS)) throw new AssertionError("save queue stuck");
  for(int i=0;i<30;i++) if(finished.get(i)!=i) throw new AssertionError("out of order");
  AtomicBoolean rejected = new AtomicBoolean();
  second.save(new byte[]{1},error -> rejected.set(error != null));
  if(!rejected.get()||new File(dir,"state.json").exists()) throw new AssertionError("save resurrected cleared data");
  File blocked = new File(dir,"not-a-directory"); Files.write(blocked.toPath(),new byte[]{1});
  DurableStateStore bad = new DurableStateStore(blocked); CountDownLatch failed = new CountDownLatch(1);
  bad.save(new byte[]{1},error -> { if(error == null) failure.set(new AssertionError("save failure was acknowledged as success")); failed.countDown(); });
  if(!failed.await(10,TimeUnit.SECONDS)) throw new AssertionError("failed save did not complete"); bad.close();
  if(failure.get()!=null) throw new AssertionError(failure.get());
  Files.delete(blocked.toPath()); Files.delete(dir.toPath());
  System.out.println("PASS: background writes, ordered durability, Activity recreation, reset barrier, error propagation");
 }
}
