/** Mounts admin commercial controls into an existing authenticated admin page.
 * The host MUST provide its authenticated Supabase client. Never creates a client or embeds keys.
 * Does not activate legacy licenses.
 */
import {createPendingOrder,confirmOrderPayment,listOrders,cancelPendingOrder} from './admin-api.mjs';
import {quote} from './catalog.mjs';
const money=n=>new Intl.NumberFormat('vi-VN').format(n)+' ₫';
export function mountCommercialAdmin({root,client}) {
 if(!root || typeof root.replaceChildren!=='function') throw new TypeError('Root element required');
 if(!client || typeof client.rpc!=='function') throw new TypeError('Authenticated Supabase client required');
 root.innerHTML=`<section aria-label="Quản lý thuê bao">
 <h2>Quản lý thuê bao</h2><p>Chỉ admin. Xác nhận thanh toán KHÔNG tự gia hạn bản quyền.</p>
 <form id="ott-order-form">
 <label>UID khách hàng <input name="customer" required placeholder="UUID" autocomplete="off"></label>
 <label>Gói <select name="plan"><option value="WEB">WEB</option><option value="WEB_PRINT" disabled>WEB + IN (chưa mở bán)</option></select></label>
 <label>Kỳ hạn <select name="months"><option value="1">1 tháng</option><option value="3">3 tháng</option><option value="6">6 tháng</option><option value="12">12 tháng</option></select></label>
 <label>Mã thanh toán <input name="reference" maxlength="120" autocomplete="off"></label>
 <p id="ott-price"></p><button type="submit">Tạo đơn chờ thanh toán</button></form>
 <p id="ott-status" role="status"></p><h3>Lịch sử đơn hàng</h3>
 <button type="button" id="ott-refresh">Tải danh sách</button>
 <div id="ott-orders"></div></section>`;
 const form=root.querySelector('#ott-order-form'),status=root.querySelector('#ott-status'),orders=root.querySelector('#ott-orders');
 const price=root.querySelector('#ott-price');
 function showPrice(){price.textContent='Giá: '+money(quote(form.elements.plan.value,Number(form.elements.months.value)).amountVnd);}
 form.elements.months.addEventListener('change',showPrice);
 form.elements.plan.addEventListener('change',showPrice);
 showPrice();
 let busy=false;
 async function load(quiet=false){
  if(busy)return false;
  busy=true;if(!quiet)status.textContent='Đang tải...';
  try{
   const rows=await listOrders(client,50);
   if(!Array.isArray(rows))throw Error('Dữ liệu đơn hàng không hợp lệ');
   orders.replaceChildren();
   for(const order of rows){
    const item=document.createElement('article');
    const label=document.createElement('p');
    label.textContent=`${order.customer_user_id} | ${order.plan_code} | ${order.duration_months} tháng | ${money(order.amount_vnd)} | ${order.status}`;
    item.append(label);
    if(order.status==='pending'){
     const button=document.createElement('button');button.type='button';button.textContent='Xác nhận đã nhận tiền';
     button.addEventListener('click',async()=>{
      if(busy||!window.confirm('Xác nhận đã nhận tiền cho đơn này? Chức năng này KHÔNG gia hạn bản quyền.'))return;
      busy=true;button.disabled=true;
      let message='';
      try{await confirmOrderPayment(client,order.id);message='Đã ghi nhận thanh toán. Bản quyền chưa được gia hạn.';}
      catch(e){message='Lỗi: '+e.message;}
      finally{busy=false;button.disabled=false;}
      const refreshed=await load(true);status.textContent=refreshed?message:message+' Danh sách chưa tải lại được.';
     });
     item.append(button);
     const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Hủy đơn chưa thanh toán';
     cancel.addEventListener('click',async()=>{
      if(busy||!window.confirm('Hủy đơn đang chờ? Không thay đổi bản quyền.'))return;
      busy=true;cancel.disabled=true;
      let message='';
      try{await cancelPendingOrder(client,order.id);message='Đã hủy đơn. Bản quyền không thay đổi.';}
      catch(e){message='Lỗi: '+e.message;}
      finally{busy=false;cancel.disabled=false;}
      const refreshed=await load(true);status.textContent=refreshed?message:message+' Danh sách chưa tải lại được.';
     });
     item.append(cancel);
    }
    orders.append(item);
   }
   if(!rows.length)orders.textContent='Chưa có đơn hàng.';
   if(!quiet)status.textContent='Đã tải '+rows.length+' đơn.';
  }catch(e){status.textContent='Không thể tải đơn hàng: '+e.message;return false;}
  finally{busy=false;}
  return true;
 }
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;
  if(!window.confirm('Tạo đơn hàng chờ thanh toán? Không cấp quyền cho khách.'))return;
  busy=true;const button=form.querySelector('[type=submit]');button.disabled=true;
  let message='';
  try{
   const id=await createPendingOrder(client,{
    customerUserId:form.elements.customer.value.trim(),planCode:form.elements.plan.value,
    durationMonths:Number(form.elements.months.value),paymentReference:form.elements.reference.value.trim()||null
   });
   message='Đã tạo đơn '+id+'. Chưa cấp quyền.';
  }catch(error){message='Lỗi: '+error.message;}
  finally{busy=false;button.disabled=false;}
  const refreshed=await load(true);
  status.textContent=refreshed?message:message+' Danh sách chưa tải lại được.';
 });
 root.querySelector('#ott-refresh').addEventListener('click',()=>load(false));
 return {refresh:load};
}
