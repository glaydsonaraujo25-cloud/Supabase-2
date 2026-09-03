import { describe,expect,it } from "vitest";
import { auditChanges,auditTitle,type AuditEntry } from "../src/lib/audit";
const entry:AuditEntry={id:"1",actor_id:"u",entity:"matches",action:"update",record_id:"m",created_at:"2026-09-03",details:{before:{status:"agendado",home_score:null,invite_code:"old"},after:{status:"finalizado",home_score:2,invite_code:"new"}}};
describe("audit presentation",()=>{
 it("uses clear Portuguese labels",()=>expect(auditTitle(entry)).toBe("alterou Partida"));
 it("shows before and after values for supported changed fields",()=>expect(auditChanges(entry)).toEqual([{field:"status",before:"agendado",after:"finalizado"},{field:"placar mandante",before:"não informado",after:"2"}]));
 it("does not show unchanged or sensitive unknown fields",()=>expect(auditChanges({...entry,details:{before:{name:"Copa",owner_id:"one"},after:{name:"Copa",owner_id:"two"}}})).toEqual([]));
 it("falls back safely for records created by the database",()=>expect(auditTitle({...entry,entity:"custom",action:"system"})).toBe("system custom"));
});
