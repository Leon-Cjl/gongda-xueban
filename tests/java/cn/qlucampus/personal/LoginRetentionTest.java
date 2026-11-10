package cn.qlucampus.personal;
public class LoginRetentionTest {
 static int checks;
 static void check(boolean value,String name){if(!value)throw new AssertionError(name);checks++;}
 public static void main(String[] args){
  LibraryIdentityRecovery a=new LibraryIdentityRecovery(1);a.reset(1,false,true);
  LibraryIdentityRecovery.RestoreAttempt restore=a.beginRestore(1000,true);check(restore!=null,"restore starts");
  a.suspend(1100);check(!a.owns(restore),"pause retires callback");check(!a.automaticUsed(),"pause returns restore budget");
  check(a.beginRestore(4099,true)==null,"resume honors pause gap");restore=a.beginRestore(4100,true);check(restore!=null,"resume can restore without user login");
  check(a.restoreFailed(restore,false,4200),"network failure accepted");check(!a.automaticUsed(),"network failure returns budget");check(a.snapshot().retryAt==34200,"first backoff is 30 seconds");
  check(a.beginRestore(34199,true)==null,"no early retry");restore=a.beginRestore(34200,true);check(restore!=null,"network recovers after delay");
  a.restoreFailed(restore,false,34300);check(a.snapshot().retryAt==94300,"second backoff is 60 seconds");
  restore=a.beginRestore(94300,true);a.installedToken(true);check(!a.owns(restore),"new token invalidates old restore");
  LibraryIdentityRecovery.Probe probe=a.beginProbe(95000,true);check(probe!=null,"identity checks new token");check(a.verifiedAfterCommit(probe),"identity verified");check(!a.automaticUsed(),"successful identity starts new session recovery budget");
  check(a.rejectedToken(a.owner()),"later school expiry retires token");check(a.beginRestore(100000,true)!=null,"later real expiry restores silently again");
  a.reset(2,false,true);restore=a.beginRestore(1000,true);a.installedToken(true);probe=a.beginProbe(2000,true);a.rejectedToken(probe.owner);
  check(a.snapshot().phase.equals("needs_user"),"rejected unverified restored token stops SSO loop");check(a.beginRestore(999999,true)==null,"no loop after failed restored token");
  a.reset(3,false,true);restore=a.beginRestore(1000,true);a.restoreFailed(restore,true,1100);check(a.beginRestore(999999,true)==null,"captcha remains explicit");
  check(a.snapshot().phase.equals("needs_user"),"captcha does not expire into auto retry");
  a.reset(4,true,true);probe=a.beginProbe(1000,true);a.retryable(probe,"TIMEOUT",1100);check(a.tokenPresent(),"network preserves token");
  probe=a.beginProbe(4000,true);a.retryable(probe,"NETWORK",4100);check(a.beginProbe(34099,true)==null,"probe round is bounded");check(a.beginProbe(34100,true)!=null,"probe can resume after round cooldown");
  a.reset(5,false,false);check(a.beginRestore(1,true)==null,"missing password never auto fills");a.credentials(true);check(a.beginRestore(2,false)==null,"background cannot restore");
  restore=a.beginRestore(3,true);a.reset(6,false,true);check(!a.restoreFailed(restore,false,4),"old identity cannot alter current recovery");
  a.reset(7,true,true);probe=a.beginProbe(1000,true);a.storageFailure();check(!a.verifiedAfterCommit(probe),"durable failure cannot verify");check(a.beginRestore(100000,true)==null,"storage failure preserves recovery gate");
  System.out.println("PASS: "+checks+" login retention policy checks");
 }
}
